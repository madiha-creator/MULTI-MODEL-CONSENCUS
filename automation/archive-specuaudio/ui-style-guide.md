# UI Style Guide — Edge AI Telemetry & Voice Optimization Dashboard

## Design Direction
Dark, infra/telemetry aesthetic — feels like a live monitoring console, 
not a generic web app.

## Color Palette

| Purpose            | Color       | Hex       |
|---------------------|-------------|-----------|
| Background (main)   | Dark navy   | #0B1220   |
| Panel/card bg       | Slate       | #131C2E   |
| Primary accent      | Cyan        | #22D3EE   |
| Live/active state    | Green       | #4ADE80   |
| Warning/drift alert | Amber       | #FBBF24   |
| Error/critical      | Red         | #F87171   |
| Text (primary)      | Off-white   | #E5E7EB   |
| Text (secondary)    | Muted grey  | #94A3B8   |
| Border/divider      | Subtle grey | #1E293B   |

## Typography

- Headings: Inter or system sans-serif, semi-bold
- Body text: Inter or system sans-serif, regular
- Numbers/data/latency values: monospace font (e.g. "JetBrains Mono" or 
  "Roboto Mono") — makes live numbers easy to scan

## Component Guidelines

### Latency Tracker Card
- Dark panel background (#131C2E)
- Large monospace number for current latency (ms)
- Small sparkline/graph below showing recent trend
- Green text if within threshold, amber if approaching limit, red if exceeded

### Grid Map / Node Topology
- Dark canvas background
- Nodes as small circles, cyan by default
- Node turns amber briefly when a drift/anomaly event fires
- Connections between nodes as thin grey lines

### Drift Adjustment Slider
- Minimal flat slider, cyan track and thumb
- Value label shown above slider in monospace

## Layout Principles
- Generous spacing, no cramped panels
- Consistent 8px spacing grid
- Rounded corners: 8px on cards, 4px on smaller elements
- Avoid pure black (#000000) — use the dark navy above instead

## Handoff Notes
- Deliver as CSS variables or Tailwind config, depending on what Ammar's 
  React setup uses — confirm with him before finalizing.