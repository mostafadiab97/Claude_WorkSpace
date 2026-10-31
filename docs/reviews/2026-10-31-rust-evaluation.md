# Would Rust make ReqMan faster? (31 Oct 2026)

**Asked by the owner (31 Oct 2026):** would writing the tool in Rust make a real difference to performance? A full
rewrite is acceptable if the advantage is big.

Tags: **F** = measured or counted in this repository, **K** = established knowledge, **I** = inference, **R** = recommendation.

## 1. Where the time goes today (F)

| What the user waits for | Time | Where it is spent |
| --- | --- | --- |
| Open a 10,000-item repository the **first** time | 3.3 s (CI test), 5–8 s on the sandbox (Linux); 18–73 s for 50k on the owner's PC (Windows Defender) | reading files 0.1 s · **YAML parsing 1.2 s** · writing the SQLite cache ≈ 2 s · antivirus scanning each file (Windows) |
| Open it again | 0.2 s | cache check only |
| Query / filter / scroll 10k items | < 40 ms (owner's PC < 15 ms) | SQLite (already C code) |
| Save one item and refresh | 0.09 s | one file + one index row |
| Compare (9,118 changed files / 3,000 real edits) | 0.4 s / 1.8 s | `git diff` + `git cat-file` (Git's own C code) + parsing |
| Pull / push / branch switch | 6–13 s per self-test step on the owner's PC | **starting git.exe 10–20 times** (each start costs ≈ 0.1–0.5 s on Windows with Defender), and the network |
| Export 10k items | CSV 0.46 s, Excel 1.8 s, ReqIF 4.9 s | building the file in memory |
| Window: table, editor | instant at 10k (virtual table) | Chromium/React — the same in a Rust app that uses a web view |
| Installer / memory | 116 MB installer; ≈ 200–300 MB RAM (K, typical Electron) | Electron ships its own Chromium + Node.js |

## 2. What Rust would change (K/I)

| Part | With Rust | Gain the owner would notice |
| --- | --- | --- |
| YAML parsing + first indexing | 5–10× faster parsing; first open of 10k ≈ 0.5–1 s instead of 3–8 s | **Small**: happens once per repository per PC; re-opening is already 0.2 s |
| Queries, filters | SQLite either way | None |
| Git operations | Same `git.exe`, or an in-process Git library (`gix`) that avoids starting processes | **Medium** on Windows (pull/switch maybe 2–4 s faster) — but most of this can be had in TypeScript too, by running fewer Git processes per action (I) |
| Antivirus scanning | Same files, same scanning | None |
| Window speed | Tauri/Rust apps still draw the UI in a web view (WebView2 on Windows); native Rust UI toolkits are far less mature for a table/tree/editor app like this | None to negative |
| Installer size, memory, start-up | Tauri: installer ≈ 10–20 MB, RAM ≈ 100 MB less, start-up a bit faster (uses Windows' WebView2 instead of shipping Chromium) | **Noticeable** for download size and older PCs — but it is *size*, not speed of daily work |

## 3. What a full rewrite would cost (F/I)

- About **15,500 lines** of TypeScript (9,600 core + main, 8,300 window code incl. styles) and **7,900 lines** of tests and
  e2e scenarios — about two months of work to reach today's state again, with no new features for the owner in that
  time, and the risk of re-introducing bugs already fixed (merge, import round trips, cache upgrades).
- A future team: TypeScript/React developers are far easier to find than Rust developers (NFR-10: conventional,
  hand-over friendly).
- The module boundaries (NFR-12) mean the core could be replaced **piece by piece** later if one piece ever becomes a
  bottleneck — no big-bang rewrite is needed to get Rust's benefits.

## 4. Recommendation (R)

**Do not rewrite now.** The waits users notice are Git starting many processes on Windows, antivirus scanning and the
network — Rust does not remove them. Measured daily actions (save, filter, scroll, compare) are already well under a
second at 10,000 items.

Better value, in order:

1. **Fewer Git processes per action** (TypeScript, small): batch status/ref queries, reuse results within one pull —
   targets the 6–13 s steps on the owner's PC directly.
2. **Faster first indexing** (TypeScript, small): a faster YAML reader for our fixed header layout, and batched SQLite
   writes — likely 2–3× on first open.
3. **If installer size or memory matters for the commercial version:** move the shell from Electron to **Tauri**. The
   React window code is kept (≈ half the code); only the Node.js core (file, Git, SQLite, import/export modules) is
   rewritten in Rust behind the same `ReqManApi` contract. Decide at the commercial stage, with measurements on target
   PCs; it is a 4–6 week project, not a rewrite from scratch.
4. If a single core part ever becomes a real bottleneck (e.g. 100k-item repositories), it can be moved into a Rust
   module called from Node.js (napi-rs) without touching the rest.

## 5. Owner's answer (31 Oct 2026) — open, to discuss with the plan

The question is **performance and maintainability**: the future engineering team may not know JavaScript/TypeScript;
Rust and Python are common in his field (Python not a good fit). Points for that discussion (R):
- The middle path keeps both benefits: **Tauri** — core (files, Git, SQLite, merge, import/export) in Rust, the
  window in TypeScript/React. A pure-Rust UI (egui, Slint, Iced) for a large table/tree/editor app is still
  immature; most Rust desktop apps draw their UI with web technology.
- Hiring: TypeScript is among the most widely known languages; Rust developers are fewer but strong in embedded/
  systems teams — which matches the owner's world (C developers move to Rust more easily than to React).
- Cost: core rewrite ≈ 9,600 lines + tests; the module boundaries and the `ReqManApi` contract make it possible
  module by module, keeping the app working throughout.
- Decide together with the rename (one "big" version) or right after it — not in the middle of feature work.

**Decision (owner, 31 Oct 2026):** a pure-Rust window cannot carry this interface today, so **no migration to Rust
now**. TypeScript stays. (The Tauri middle path remains a possible later step if a Rust-speaking team takes over.)
