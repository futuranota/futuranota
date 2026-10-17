// --- Demo ---
"use client";

import * as React from "react";
import { StorageDistrict, type StorageNode } from "@/components/ui/storage-district";

const file = (id: string, name: string, bytes: number): StorageNode => ({ id, name, bytes, kind: "file", modifiedAt: "2026-10-05T10:00:00Z" });
const folder = (id: string, name: string, children: StorageNode[]): StorageNode => ({ id, name, children, kind: "folder", modifiedAt: "2026-10-06T09:30:00Z" });

export const demoRoot: StorageNode = folder("workspace", "Workspace", [
  folder("design", "Product Design", [folder("screens", "Screens", [file("dashboard", "Dashboard.fig", 820_000_000), file("mobile", "Mobile flows.fig", 610_000_000)]), folder("components", "Components", [file("system", "Design system.fig", 470_000_000), file("tokens", "Tokens.json", 48_000)]), file("prototype", "Prototype.mp4", 1_220_000_000)]),
  folder("engineering", "Engineering", [folder("artifacts", "Build artifacts", [file("build-main", "Production.tar.gz", 1_750_000_000), file("build-preview", "Preview.tar.gz", 640_000_000)]), file("source", "Source.zip", 220_000_000), file("coverage", "Coverage.html", 17_000_000)]),
  folder("media", "Media", [folder("recordings", "Recordings", [file("launch", "Launch edit.mov", 4_450_000_000), file("demo", "Product demo.mp4", 2_180_000_000)]), file("stills", "Product stills.zip", 940_000_000)]),
  folder("brand", "Brand", [file("identity", "Brand identity.pdf", 148_000_000), file("fonts", "Font family.zip", 36_000_000), file("logos", "Logos.svg", 520_000)]),
  folder("research", "Research", [folder("interviews", "Interviews", [file("interview-a", "Interview 01.mp4", 1_280_000_000), file("interview-b", "Interview 02.mp4", 920_000_000)]), file("findings", "Findings.pdf", 11_000_000), folder("empty-notes", "New studies", [])]),
  folder("documents", "Documents", [file("roadmap", "Roadmap.pdf", 9_200_000), file("brief", "Product brief.docx", 4_600_000), file("budget", "Budget.xlsx", 780_000)]),
  folder("archive", "Archive", [folder("last-year", "2025", [file("project-2025", "Project archive.zip", 3_280_000_000), file("assets-2025", "Assets.zip", 1_640_000_000)]), file("handover", "Handover.pdf", 12_000_000)]),
  folder("exports", "Exports", [file("videos", "Component videos.zip", 2_920_000_000), file("thumbnails", "Thumbnails.zip", 480_000_000), file("exports-readme", "Readme.md", 3200)]),
]);

export default function Default() {
  return <div style={{ width: "100%", padding: "24px 0" }}><StorageDistrict root={demoRoot} capacityBytes={64_000_000_000} /><p style={{ margin: "12px 0 0", textAlign: "center", fontFamily: "system-ui, sans-serif", fontSize: 11, color: "light-dark(#777, #999)" }}>Sample workspace · Select a block, then open its folder</p></div>;
}
