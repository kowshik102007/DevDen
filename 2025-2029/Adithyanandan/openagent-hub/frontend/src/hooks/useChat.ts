import { useState, useCallback, useRef } from 'react';
import {
  listConversations,
  getConversation,
  deleteConversation as apiDelete,
  renameConversation as apiRename,
  truncateConversation,
  streamChat,
  Conversation,
  ConversationDetail,
  Message,
} from '../services/chat';

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ConversationDetail | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingTools, setStreamingTools] = useState<{ tool: string; input?: any; output?: string }[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ model: string; provider?: string | null; reason?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async (projectId?: string | null) => {
    const list = await listConversations(projectId);
    setConversations(list);
    return list;
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    const detail = await getConversation(id);
    setCurrentConversation(detail);
    setError(null);
    return detail;
  }, []);

  const startNewChat = useCallback(() => {
    setCurrentConversation(null);
    setStreamingContent('');
    setError(null);
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      await apiDelete(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversation?.id === id) setCurrentConversation(null);
    },
    [currentConversation]
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      const updated = await apiRename(id, title);
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: updated.title } : c)));
      if (currentConversation?.id === id) {
        setCurrentConversation((prev) => (prev ? { ...prev, title: updated.title } : prev));
      }
    },
    [currentConversation]
  );

  const sendMessage = useCallback(
    async (
      message: string,
      model: string | null,
      attachmentIds?: string[],
      providerId?: string | null,
      opts?: { useTools?: boolean; toolMode?: 'off' | 'auto' | 'always'; toolNames?: string[] | null; skillId?: string | null; skillAuto?: boolean; routingMode?: string },
    ) => {
      const token = localStorage.getItem('token');
      if (!token) return;

      setError(null);
      setIsStreaming(true);
      setStreamingContent('');
      setStreamingTools([]);
      setRouteInfo(null);

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };

      setCurrentConversation((prev) =>
        prev ? { ...prev, messages: [...prev.messages, userMessage] } : null
      );

      let resolvedConvId: string | null = currentConversation?.id ?? null;

      const controller = streamChat(
        message,
        resolvedConvId,
        model,
        token,
        (chunk) => {
          setStreamingContent((prev) => prev + chunk);
        },
        (id) => {
          resolvedConvId = id;
          if (!currentConversation) {
            setCurrentConversation({
              id,
              title: 'New Conversation',
              model,
              project_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              messages: [userMessage],
            });
          }
        },
        async () => {
          setIsStreaming(false);
          setStreamingContent('');
          setStreamingTools([]);
          if (resolvedConvId) {
            const detail = await getConversation(resolvedConvId);
            setCurrentConversation(detail);
          }
          const list = await listConversations();
          setConversations(list); // refresh full list after stream
        },
        (err) => {
          setIsStreaming(false);
          setStreamingContent('');
          setStreamingTools([]);
          setError(err);
        },
        attachmentIds,
        providerId,
        {
          useTools: opts?.useTools,
          toolMode: opts?.toolMode,
          toolNames: opts?.toolNames,
          skillId: opts?.skillId,
          skillAuto: opts?.skillAuto,
          routingMode: opts?.routingMode,
          onRoute: (info) => setRouteInfo(info),
          onToolCall: (tool, input) => setStreamingTools((p) => [...p, { tool, input }]),
          onToolResult: (tool, output) =>
            setStreamingTools((p) => {
              // attach the output to the most recent matching pending tool call
              const idx = [...p].reverse().findIndex((t) => t.tool === tool && t.output === undefined);
              if (idx === -1) return [...p, { tool, output }];
              const realIdx = p.length - 1 - idx;
              const next = [...p];
              next[realIdx] = { ...next[realIdx], output };
              return next;
            }),
        },
      );

      abortRef.current = controller;
    },
    [currentConversation]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingContent('');
    setStreamingTools([]);
  }, []);

  const editMessage = useCallback(
    async (messageId: string, newContent: string, model: string | null, providerId?: string | null) => {
      if (!currentConversation) return;
      await truncateConversation(currentConversation.id, messageId);
      setCurrentConversation((prev) => {
        if (!prev) return prev;
        const idx = prev.messages.findIndex((m) => m.id === messageId);
        return idx === -1 ? prev : { ...prev, messages: prev.messages.slice(0, idx) };
      });
      await sendMessage(newContent, model, undefined, providerId);
    },
    [currentConversation, sendMessage]
  );

  const regenerateResponse = useCallback(
    async (model: string | null, providerId?: string | null) => {
      if (!currentConversation) return;
      const msgs = currentConversation.messages;
      const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');
      const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
      if (!lastAssistant || !lastUser) return;
      await truncateConversation(currentConversation.id, lastAssistant.id);
      setCurrentConversation((prev) => {
        if (!prev) return prev;
        const idx = prev.messages.findIndex((m) => m.id === lastAssistant.id);
        return idx === -1 ? prev : { ...prev, messages: prev.messages.slice(0, idx) };
      });
      await sendMessage(lastUser.content, model, undefined, providerId);
    },
    [currentConversation, sendMessage]
  );

  return {
    conversations,
    currentConversation,
    isStreaming,
    streamingContent,
    streamingTools,
    routeInfo,
    error,
    loadConversations,
    selectConversation,
    startNewChat,
    deleteConversation,
    renameConversation,
    sendMessage,
    stopStreaming,
    editMessage,
    regenerateResponse,
  };
}
