'use client';

import React from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface LocationExtension {
  url: string;
  valueInteger?: number;
  valueDecimal?: number;
}

interface LocationResource {
  resource: {
    resourceType: 'Location';
    id: string;
    name: string;
    physicalType: { coding: Array<{ code: string }> };
    extension: LocationExtension[];
  };
}

interface BedStatusBundle {
  resourceType: 'Bundle';
  type: string;
  entry: LocationResource[];
}

export default function BedStatus() {
  const theme = useTheme();
  const { isReady, getToolOutput } = useWidgetSDK();
  const data = getToolOutput<BedStatusBundle>();

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        🏥 Loading bed status telemetry...
      </div>
    );
  }

  if (!data || data.resourceType !== 'Bundle' || !data.entry) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
        ⚠️ Bed status data is currently unavailable.
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  const getCapacityState = (name: string, percent: number) => {
    // Red if ICU > 85%, amber if ward > 90% (or standard ward warning rules)
    const isICU = name.toLowerCase().includes('icu');
    if (isICU && percent > 85) {
      return { label: 'CRITICAL', color: '#ef4444', gradient: 'linear-gradient(90deg, #ef4444 0%, #fca5a5 100%)' };
    }
    if (!isICU && percent > 90) {
      return { label: 'CRITICAL', color: '#ef4444', gradient: 'linear-gradient(90deg, #ef4444 0%, #fca5a5 100%)' };
    }
    if (percent > 75) {
      return { label: 'WARNING', color: '#f59e0b', gradient: 'linear-gradient(90deg, #f59e0b 0%, #fde047 100%)' };
    }
    return { label: 'STABLE', color: '#10b981', gradient: 'linear-gradient(90deg, #10b981 0%, #a7f3d0 100%)' };
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
            <span>🏥</span> Bed & Ward Occupancy Tracker
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textMuted }}>
            FHIR Location status telemetry
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
          Census
        </span>
      </div>

      {/* Ward Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.entry.map((entry) => {
          const ward = entry.resource;
          const total = ward.extension.find(ext => ext.url === 'totalBeds')?.valueInteger ?? 1;
          const occupied = ward.extension.find(ext => ext.url === 'occupied')?.valueInteger ?? 0;
          const percent = ward.extension.find(ext => ext.url === 'occupancyPercent')?.valueDecimal ?? 0;

          const capState = getCapacityState(ward.name, percent);

          return (
            <div key={ward.id} style={{
              background: cardBgColor,
              border: borderStyle,
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 700 }}>
                  {ward.name} {ward.name.toLowerCase().includes('icu') ? '🚨' : ''}
                </span>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: 'white',
                  background: capState.color,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  letterSpacing: '0.02em',
                }}>
                  {capState.label}
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{
                  width: '100%',
                  height: '10px',
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  borderRadius: '5px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${percent}%`,
                    height: '100%',
                    background: capState.gradient,
                    borderRadius: '5px',
                  }} />
                </div>

                {/* Sub row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: textMuted,
                  fontFamily: 'monospace',
                }}>
                  <span>
                    Beds: <strong style={{ color: textColor }}>{occupied}</strong> / {total}
                  </span>
                  <span style={{ fontWeight: 'bold', color: capState.color }}>
                    {percent}% occupied
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
