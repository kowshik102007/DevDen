'use client';

import React from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface SupplyDeliveryResource {
  resource: {
    resourceType: 'SupplyDelivery';
    id: string;
    status: string;
    product: { code: { text: string } };
    quantity: { value: number };
    extension: Array<{ url: string; valueInteger: number }>;
  };
}

interface BloodBankBundle {
  resourceType: 'Bundle';
  type: string;
  entry: SupplyDeliveryResource[];
}

export default function BloodBank() {
  const theme = useTheme();
  const { isReady, getToolOutput } = useWidgetSDK();
  const data = getToolOutput<BloodBankBundle>();

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        🩸 Loading blood bank registry...
      </div>
    );
  }

  if (!data || data.resourceType !== 'Bundle' || !data.entry) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
        ⚠️ Blood bank inventory is currently unavailable.
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  const getStockStatus = (units: number) => {
    if (units <= 3) return { label: 'CRITICAL', color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2' };
    if (units <= 10) return { label: 'LOW', color: '#f59e0b', bg: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7' };
    return { label: 'NORMAL', color: '#10b981', bg: isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5' };
  };

  const getExpiryStyles = (days: number) => {
    if (days <= 5) return { color: '#ef4444', fontWeight: 'bold' };
    if (days <= 7) return { color: '#f59e0b', fontWeight: '500' };
    return { color: textMuted, fontWeight: 'normal' };
  };

  return (
    <div style={{
      background: bgColor,
      color: textColor,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
      borderRadius: '16px',
      border: borderStyle,
      maxWidth: '650px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: borderStyle,
        paddingBottom: '12px',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🩸</span> Blood Bank Inventory
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textMuted }}>
            FHIR SupplyDelivery Inventory telemetry
          </p>
        </div>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          padding: '4px 8px',
          borderRadius: '12px',
          color: textMuted,
        }}>
          Live Stock
        </span>
      </div>

      {/* Inventory Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: '12px',
      }}>
        {data.entry.map((entry) => {
          const item = entry.resource;
          const bloodType = item.product.code.text;
          const units = item.quantity.value;
          const expiryDays = item.extension.find(ext => ext.url === 'expiryDays')?.valueInteger ?? 0;

          const stock = getStockStatus(units);
          const expiryStyle = getExpiryStyles(expiryDays);

          return (
            <div key={item.id} style={{
              background: cardBgColor,
              border: borderStyle,
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              minHeight: '110px',
            }}>
              {/* Type & Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#ef4444' }}>
                  {bloodType}
                </span>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: stock.color,
                  background: stock.bg,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  letterSpacing: '0.02em',
                }}>
                  {stock.label}
                </span>
              </div>

              {/* Units Remaining */}
              <div style={{ margin: '10px 0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'monospace' }}>
                  {units}
                </span>
                <span style={{ fontSize: '12px', color: textMuted, fontWeight: 500 }}>
                  units
                </span>
              </div>

              {/* Expiry */}
              <div style={{
                fontSize: '11px',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                paddingTop: '6px',
                color: expiryStyle.color,
                fontWeight: expiryStyle.fontWeight,
              }}>
                ⏳ {expiryDays}d to expire
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
