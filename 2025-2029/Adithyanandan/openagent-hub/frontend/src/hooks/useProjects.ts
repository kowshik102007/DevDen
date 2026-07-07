import { useState, useCallback } from 'react';
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  Project,
} from '../services/projects';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);

  const loadProjects = useCallback(async () => {
    const list = await listProjects();
    setProjects(list);
    return list;
  }, []);

  const addProject = useCallback(async (name: string) => {
    const p = await createProject(name);
    setProjects((prev) => [p, ...prev]);
    return p;
  }, []);

  const renameProject = useCallback(async (id: string, name: string) => {
    const p = await updateProject(id, { name });
    setProjects((prev) => prev.map((x) => (x.id === id ? p : x)));
  }, []);

  const removeProject = useCallback(async (id: string) => {
    await deleteProject(id);
    setProjects((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return { projects, loadProjects, addProject, renameProject, removeProject };
}
