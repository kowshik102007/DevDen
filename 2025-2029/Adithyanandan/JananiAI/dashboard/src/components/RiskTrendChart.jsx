import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';

/**
 * RiskTrendChart — Enhanced with reference lines, gradient fills, and better styling.
 * Inspired by ASHAShield's TrendGraphScreen with clinical threshold annotations.
 */

const trendData = [
  { week: 'W9',  Barmer: 8,  Jalore: 5, Sirohi: 3, Ajmer: 4, Bhilwara: 2, Udaipur: 3, Pratapgarh: 2 },
  { week: 'W10', Barmer: 10, Jalore: 6, Sirohi: 4, Ajmer: 5, Bhilwara: 3, Udaipur: 4, Pratapgarh: 3 },
  { week: 'W11', Barmer: 7,  Jalore: 4, Sirohi: 2, Ajmer: 3, Bhilwara: 4, Udaipur: 5, Pratapgarh: 4 },
  { week: 'W12', Barmer: 12, Jalore: 7, Sirohi: 5, Ajmer: 6, Bhilwara: 3, Udaipur: 4, Pratapgarh: 3 },
  { week: 'W13', Barmer: 9,  Jalore: 5, Sirohi: 4, Ajmer: 4, Bhilwara: 5, Udaipur: 6, Pratapgarh: 5 },
  { week: 'W14', Barmer: 11, Jalore: 8, Sirohi: 6, Ajmer: 7, Bhilwara: 4, Udaipur: 5, Pratapgarh: 4 },
  { week: 'W15', Barmer: 13, Jalore: 9, Sirohi: 5, Ajmer: 6, Bhilwara: 6, Udaipur: 7, Pratapgarh: 6 },
  { week: 'W16', Barmer: 15, Jalore: 10, Sirohi: 7, Ajmer: 8, Bhilwara: 7, Udaipur: 8, Pratapgarh: 7 },
];

const DISTRICT_COLORS = {
  Barmer:     '#C62828',
  Jalore:     '#EF6C00',
  Sirohi:     '#F9A825',
  Ajmer:      '#F57F17',
  Bhilwara:   '#33691E',
  Udaipur:    '#1565C0',
  Pratapgarh: '#6A1B9A',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload) return null;

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '12px 16px',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--text-primary)' }}>
        Week {label}
      </div>
      {payload
        .sort((a, b) => b.value - a.value)
        .map((entry, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: entry.color,
              }}
            />
            <span style={{ color: 'var(--text-secondary)', minWidth: 70 }}>
              {entry.name}
            </span>
            <span style={{ fontWeight: 700, color: entry.color }}>
              {entry.value}
            </span>
          </div>
        ))}
    </div>
  );
}

function RiskTrendChart() {
  // Calculate total HIGH risk across all districts for each week
  const totalData = trendData.map(week => ({
    ...week,
    Total: Object.keys(DISTRICT_COLORS).reduce((sum, d) => sum + (week[d] || 0), 0),
  }));

  return (
    <div>
      {/* Summary stats row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div
          className="animate-fade-in-up"
          style={{
            background: 'var(--risk-high-bg)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 20 }}>📈</span>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Current Week (W16)</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--risk-high)' }}>
              {totalData[totalData.length - 1]?.Total} HIGH cases
            </div>
          </div>
        </div>
        <div
          className="animate-fade-in-up"
          style={{
            background: 'var(--risk-moderate-bg)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animationDelay: '100ms',
          }}
        >
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Trending District</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--risk-moderate)' }}>
              Barmer ↑
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={totalData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="week"
            stroke="var(--text-secondary)"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke="var(--text-secondary)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
            iconType="circle"
            iconSize={8}
          />

          {/* Reference line for alert threshold */}
          <ReferenceLine
            y={10}
            stroke="var(--risk-high)"
            strokeDasharray="5 5"
            strokeOpacity={0.5}
            label={{
              value: 'Alert threshold',
              position: 'insideTopRight',
              fill: 'var(--risk-high)',
              fontSize: 10,
            }}
          />

          {Object.entries(DISTRICT_COLORS).map(([district, color]) => (
            <Line
              key={district}
              type="monotone"
              dataKey={district}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: color, stroke: 'white', strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Clinical note — Inspired by ASHAShield's refLine annotations */}
      <div
        style={{
          marginTop: 12,
          fontSize: 11,
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>⚠️</span>
        Districts exceeding 10 HIGH-risk cases/week trigger automatic ANM supervisor alerts.
        Barmer shows a consistent upward trend — intervention recommended.
      </div>
    </div>
  );
}

export default RiskTrendChart;