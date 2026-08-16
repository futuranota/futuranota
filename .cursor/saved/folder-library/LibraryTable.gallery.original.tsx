/**
 * Library table — UI REFERENCE ONLY (do not import into the app).
 *
 * Source: Magic “AI Multi-Modal Generation” demo — stripped to the pieces Futura Nota wants.
 *
 * KEEP for FN library home:
 * - Type toggle (in Magic = Image/Video/Avatar tabs → in FN = Image/PDF/Video/Skill file types)
 * - Thumb grid (“Recent Generations” pattern) for fichas of the active type
 * - [+] add control (not in this snippet; product: add ficha named by user into current type)
 *
 * OMIT entirely (do not port):
 * - AI generation, prompts, models, resolution, style, lighting, pose, seed, steps
 * - Loading progress, generate CTA, download-from-gen
 * - Generation history search / History chrome
 * - next/image, lucide-react, shadcn Tabs/Card as dependencies — adapt to FN JSX + CSS #151515
 *
 * Product rules: see BRIEF.md — no “All” mix in v1; one type at a time.
 */

import type React from "react"
import Image from "next/image"
import { ImageIcon, Film, CuboidIcon as Cube } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

/** In FN these become file categories (image | pdf | video | skill), not generation modes. */
type LibraryFileTypeTab = "image" | "video" | "avatar"

interface LibraryThumbItem {
  id: string
  type: LibraryFileTypeTab
  url: string
  /** In FN: ficha tag / name */
  prompt: string
  timestamp: Date
}

/**
 * Type tabs — Magic used generation modes; FN maps this UX to file-type filter only.
 */
export function LibraryTypeTabsExample({
  value,
  onChange,
}: {
  value: LibraryFileTypeTab
  onChange: (v: LibraryFileTypeTab) => void
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as LibraryFileTypeTab)} className="w-full px-4">
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="image" className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          <span>Image</span>
        </TabsTrigger>
        <TabsTrigger value="video" className="flex items-center gap-2">
          <Film className="w-4 h-4" />
          <span>Video</span>
        </TabsTrigger>
        <TabsTrigger value="avatar" className="flex items-center gap-2">
          <Cube className="w-4 h-4" />
          <span>3D Avatar</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

/**
 * Thumb grid — the “table” pattern to adapt (grid of aspect-square previews).
 * Magic labeled this “Recent Generations”; in FN it is the library ficha grid for the active type.
 */
export function LibraryThumbGridExample({ items }: { items: LibraryThumbItem[] }) {
  const slice = items.slice(0, 3)
  if (slice.length === 0) return null

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-zinc-500">Recent Generations</h4>
      <div className="grid grid-cols-4 gap-2">
        {slice.map((item) => (
          <div key={item.id} className="relative group aspect-square rounded-lg overflow-hidden">
            <Image
              src={item.url || "/placeholder.svg?height=100&width=100"}
              alt={item.prompt}
              width={100}
              height={100}
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
              <div className="flex items-center gap-1">
                {item.type === "image" && <ImageIcon className="w-3 h-3 text-white" />}
                {item.type === "video" && <Film className="w-3 h-3 text-white" />}
                {item.type === "avatar" && <Cube className="w-3 h-3 text-white" />}
                <span className="text-[10px] text-white truncate">
                  {new Date(item.timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
