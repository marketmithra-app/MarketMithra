"use client";

import { useState, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
} from "reactflow";

import IndicatorNode from "./nodes/IndicatorNode";
import FusionNode from "./nodes/FusionNode";
import SignalNode from "./nodes/SignalNode";
import PriceNode from "./nodes/PriceNode";
import EmaStackNode from "./nodes/EmaStackNode";
import RelativeStrengthNode from "./nodes/RelativeStrengthNode";
import DeliveryNode from "./nodes/DeliveryNode";
import VolumeVwapNode from "./nodes/VolumeVwapNode";
import AiNewsNode from "./nodes/AiNewsNode";
import AnnouncementsNode from "./nodes/AnnouncementsNode";
import CanvasLegend from "./CanvasLegend";
import { fetchAnnouncements } from "@/lib/api";
import type { StockSnapshot, BSEAnnouncement } from "@/lib/types";

const nodeTypes = {
  price: PriceNode,
  indicator: IndicatorNode,
  fusion: FusionNode,
  signal: SignalNode,
  emaStack: EmaStackNode,
  rs: RelativeStrengthNode,
  delivery: DeliveryNode,
  volumeVwap: VolumeVwapNode,
  aiNews: AiNewsNode,
  announcements: AnnouncementsNode,
};

interface Props {
  snapshot: StockSnapshot;
}

export default function StockCanvas({ snapshot }: Props) {
  const [announcements, setAnnouncements] = useState<BSEAnnouncement[] | null>(null);

  useEffect(() => {
    setAnnouncements(null); // reset to loading on symbol change
    fetchAnnouncements(snapshot.symbol).then((res) => {
      setAnnouncements(res.announcements);
    });
  }, [snapshot.symbol]);

  const { nodes, edges } = useMemo(
    () => buildGraph(snapshot, snapshot.fusion.probability, announcements),
    [snapshot, announcements],
  );

  return (
    <div className="h-full w-full relative">
      <CanvasLegend />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        panOnDrag
        zoomOnScroll
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1}
          color="#1e293b"
        />
        <Controls
          className="!bg-[#11131c] !border !border-slate-700 !text-slate-200"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}

function buildGraph(
  s: StockSnapshot,
  fusionProbability: number,
  announcements: BSEAnnouncement[] | null,
): { nodes: Node[]; edges: Edge[] } {
  const indicatorX = 380;
  const fusionX = 780;
  const signalX = 1100;
  const startY = -100;
  const gapY = 130;

  const slots: Array<{ id: string; node: Node }> = [
    {
      id: "rs",
      node: {
        id: "rs",
        type: "rs",
        position: { x: indicatorX, y: 0 },
        data: { symbol: s.symbol, rs: s.indicators.rs },
      },
    },
    {
      id: "delivery",
      node: {
        id: "delivery",
        type: "delivery",
        position: { x: indicatorX, y: 0 },
        data: { symbol: s.symbol, delivery: s.indicators.delivery },
      },
    },
    {
      id: "ema",
      node: {
        id: "ema",
        type: "emaStack",
        position: { x: indicatorX, y: 0 },
        data: { symbol: s.symbol, ema: s.indicators.ema },
      },
    },
    {
      id: "momentum",
      node: {
        id: "momentum",
        type: "indicator",
        position: { x: indicatorX, y: 0 },
        data: {
          title: "Momentum",
          symbol: s.symbol,
          value: s.indicators.momentum.label,
          series: s.indicators.momentum.series,
          rangeLabel: "20D",
          accent: "border-orange-400",
          glow: "rgba(251,146,60,0.45)",
          stroke: "#fb923c",
          fill: "rgba(251,146,60,0.18)",
          emoji: "🚀",
        },
      },
    },
    {
      id: "volume",
      node: {
        id: "volume",
        type: "volumeVwap",
        position: { x: indicatorX, y: 0 },
        data: { symbol: s.symbol, volume: s.indicators.volume },
      },
    },
  ];

  if (s.indicators.aiNews) {
    const aiNews = s.indicators.aiNews;
    slots.push({
      id: "aiNews",
      node: {
        id: "aiNews",
        type: "aiNews",
        position: { x: indicatorX, y: 0 },
        data: {
          label: aiNews.label,
          result: aiNews,
          symbol: s.symbol,
          fusionProbability,   // NEW
        },
      },
    });
  }

  slots.forEach((slot, i) => {
    slot.node.position.y = startY + i * gapY;
  });

  const fusionY = startY + (gapY * (slots.length - 1)) / 2;

  const edgeColor: Record<string, string> = {
    rs: "#34d399",
    delivery: "#22d3ee",
    ema: "#fbbf24",
    momentum: "#fb923c",
    volume: "#a78bfa",
    aiNews: "#e879f9",
  };

  const aiNewsIndex = slots.findIndex((sl) => sl.id === "aiNews");
  const annY = aiNewsIndex >= 0
    ? (slots[aiNewsIndex].node.position.y ?? 0) + 180
    : startY + slots.length * gapY;

  const nodes: Node[] = [
    {
      id: "price",
      type: "price",
      position: { x: 30, y: fusionY },
      data: {
        symbol: s.symbol,
        name: s.name,
        price: s.price,
        series: s.priceSeries,
      },
    },
    ...slots.map((slot) => slot.node),
    {
      id: "announcements",
      type: "announcements",
      position: { x: indicatorX, y: annY },
      data: { announcements, symbol: s.symbol },
    },
    {
      id: "fusion",
      type: "fusion",
      position: { x: fusionX, y: fusionY },
      data: { probability: s.fusion.probability },
    },
    {
      id: "signal",
      type: "signal",
      position: { x: signalX, y: fusionY + 10 },
      data: { verdict: s.fusion.verdict },
    },
  ];

  const edges: Edge[] = [
    ...slots.map<Edge>((slot) => ({
      id: `price-${slot.id}`,
      source: "price",
      target: slot.id,
      animated: true,
      style: {
        stroke: edgeColor[slot.id] ?? "#64748b",
        strokeWidth: 1.5,
        opacity: 0.55,
      },
    })),
    ...slots.map<Edge>((slot) => {
      const newsScore = s.indicators.aiNews?.score ?? 0;
      const techScore = fusionProbability * 2 - 1;
      const isConflict = slot.id === "aiNews"
        && (newsScore > 0.4 && techScore < -0.4 || newsScore < -0.4 && techScore > 0.4);
      return {
        id: `${slot.id}-fusion`,
        source: slot.id,
        target: "fusion",
        animated: true,
        style: isConflict
          ? { stroke: "#f59e0b", strokeDasharray: "5,3", strokeWidth: 1.5 }
          : {
              stroke: edgeColor[slot.id] ?? "#64748b",
              strokeWidth: 1.5,
              opacity: 0.75,
            },
      };
    }),
    {
      id: "fusion-signal",
      source: "fusion",
      target: "signal",
      animated: true,
      style: { stroke: "#a5b4fc", strokeWidth: 2 },
    },
    {
      id: "aiNews-announcements",
      source: "aiNews",
      target: "announcements",
      animated: false,
      style: { stroke: "#334155", strokeDasharray: "3,3", strokeWidth: 1, opacity: 0.5 },
    },
  ];

  return { nodes, edges };
}
