# Whole-project review (cf0cc3c) — Arabic reviewer

Scope: all of `src/shared/text-ar.ts` read against `src/shared/text.ts` (same keys, meaning, terms, number agreement, right-to-left handling), the Arabic labels in `config/default-schema.yaml`, `src/shared/guide.ts` (no Arabic part exists: the guide is English only, announced by `settings.nav.guideNote`) and the one Arabic screenshot `e2e/out/language-1-arabic.png` (language scenario). Right-to-left mark: the file adds U+200F to every string through `marked()` (lines 989-996), so no key is missing it (F, read). F = checked, I = likely.

| ID | file:line | severity | what is wrong | suggested fix |
| --- | --- | --- | --- | --- |
| AR-01 | text-ar.ts:10-17 | Medium | F: `pl()` gives "0 عنصرًا" for zero (also "0 تغييرًا", "0 روابطًا"-style forms for rows, lines, problems, choices). In Arabic zero takes the plural genitive ("0 عناصر") or a phrase ("لا عناصر"). The comment above `pl` repeats the mistake ("0 ... singular accusative"). | Add a zero case: `count === 0 ? 'لا ' + few` (or `0 ${few}`); fix the comment. |
| AR-02 | text-ar.ts:272, 298, 318, 535, 906 | Medium | F: a counted noun is followed by a verb or adjective that does not agree. `countLinks` "رابط واحد أُضيفت" (should be أُضيف; dual أُضيفا); `needsDecision` "عنصر واحد تغيّرت" (تغيّر); `invalidAfter` "عنصر واحد لها قيم" (له); `exportChosen` and `chosen` "عناصر المختارة" / "عنصر واحد المختارة" (indefinite noun with definite adjective: write "المختارة" only with a definite noun, e.g. "تصدير العناصر المختارة (N)" or "تصدير N مختار"). Line 916 `جُلب ${items} متغيّرة` has the same problem for 1 and 2. | Split the one/two/many cases as `branches.ask` already does (`count === 1 ? 'له' : 'لها'`); reword exportChosen/chosen with a number in brackets. |
| AR-03 | text-ar.ts:91, 158, 164, 215, 826 | Low | F: a bare number plus a singular noun for small counts: `themeWarnings` "3 تحذير", `dataTest.running` "على 5 عنصر", `matches` "(4 نتيجة)", `linksTooltip` "3 رابط من هذا العنصر", `workspace.of` "5 من 8 عنصر". Correct for 11+, wrong for 3-10 and 1-2. | Use the existing helpers (`items()`, `links()`) or a `pl()` for warnings and results. |
| AR-04 | text-ar.ts:208, 459, 473-477, 812, 966 | Medium | F: no single term for parent/child. Parent is "الأصل" (columns, picker, import), but missing parents are "آباء غير موجودين" (812), children are "عنصر ابن / أبناء" (476-477, 966) and siblings "الإخوة" (473, 475). "الأصل" (origin) reads as a different idea from "أب". Family words for items sound odd to engineers. | Pick one pair, recommended: parent = "العنصر الأب" (short "الأب"), child = "عنصر فرعي" (plural "عناصر فرعية"), siblings = "العناصر المجاورة"; apply to all lines listed; add to the glossary. |
| AR-05 | text-ar.ts:573, 592, 599, 618, 708, 916 | Medium | F: "pull" is "سحب" in the glossary and on the buttons (`git.pull`, `pullN`, `lastPull`), but the same action is "جلب" in `git.pullTooltip`, `branches.pullFrom`, `choosePull`, `mergeDialog.title`, `compare.lastPull` and `merge.broughtIn` ("جُلب"). Same idea, two words; "جلب" is normally "fetch". | Use "سحب" everywhere: "سحب التغييرات من…", "سحب التغييرات إلى X من أي فرع؟", "سُحب N عنصرًا…". |
| AR-06 | text-ar.ts:705 | Low | F: Git tag is "وسم" and the item field "Tags" is "الوسوم" (config/default-schema.yaml:49) — one word for two ideas on the same screens (Filters, Compare). | Keep "الوسوم" for field tags; call Git tags "علامات إصدار" (or "وسم Git") in `compare.refKinds.tag`. |
| AR-07 | text-ar.ts:409 (+ 411, 439, 463), 525 | Low | F: spelling varies. "سجل كبير" (409) vs "سجلّ" (411 and most other keys); "مثلاً" (525) vs "مثلًا" elsewhere. | Choose "سجلّ" and "مثلًا" everywhere (also glossary row "history"). |
| AR-08 | text-ar.ts:910 | Low | F: "استخدم حروفًا لاتينية وأرقامًا و- و/" — the lone symbols between Arabic words are bidirectionally neutral and will be shuffled ("-" and "/" jump to the wrong side). | Spell them: "والواصلة (-) والشرطة المائلة (/)" with each symbol in brackets, or put them last. |
| AR-09 | text-ar.ts:989-996 | Low | I: `marked()` also prefixes tokens that are used as values or glued in sentences: `brand.name`, `brand.dev`, `app.language.en/ar`, `common.ellipsis`, `workspace.filterSep`, `fields.builtIn`, fragments such as `initBefore`, `introAfter`. A mark inside a joined sentence is harmless, but a text compared with a fixed string or copied (brand name in the title bar, language list) carries an invisible character. | Skip `marked()` for the keys that are product names or single symbols, or test that no code compares these texts. |
| AR-10 | text-ar.ts:3 | Low | F: header comment still names ReqMan among the Latin product names. | Replace "ReqMan" with "reqochet-dev". |
| AR-11 | e2e/out/language-1-arabic.png (ID column of the table) | Medium | I: the ID cell shows "WGRGS99"; the start "REQ-" is cut off, while in the left-aligned Latin text the end should be the clipped part. In the right-to-left window the ellipsis/clip is applied at the wrong end for a Latin ID (the header "المعرّف" is also cut at the left edge). Same cell in the editor header is fine. | Make the ID column's text `direction: ltr; text-align: start` (logical) with a wider default width in Arabic, or isolate the ID with `unicode-bidi: isolate`; re-check in `language` scenario. |
| AR-12 | config/default-schema.yaml:22 | Low | I: Defect = "عيب". Software and test engineers write "خلل" (or "عيب" only in manufacturing). Also Heading/Information = "عنوان / معلومات" (line 26) reuses "عنوان" which is also the Title field. | Use "خلل" for Defect; "رأس / معلومات" or "عنوان قسم / معلومات" for Heading. |
| AR-13 | config/default-schema.yaml:52-57 | Low | I: Arabic link names ("يُفصِّل", "مُفصَّل بـ", "مرتبط بـ") come from the schema and are not passed through `marked()`; when shown in native tooltips beside an ID (e.g. "مرتبط بـ REQ-…") word order can break. Also "relates to" and "related to" are the same text, so the two directions look identical. | Add a right-to-left mark when the app renders schema labels in Arabic (one place, in the label lookup). |

## Glossary proposals (`docs/guides/arabic-glossary.md`)

| English | Arabic (proposed) | Note |
| --- | --- | --- |
| parent / child / sibling | الأب / عنصر فرعي / العناصر المجاورة | replaces أصل / ابن / إخوة (AR-04) |
| pull (verb) | سحب | never "جلب" (AR-05); fetch = جلب if ever needed |
| pull request | طلب السحب | used in compare texts |
| tag (field) / Git tag | وسم / علامة إصدار | (AR-06) |
| merge | دمج | |
| decision (merge window) | قرار | |
| discard / undo / revert | إهمال / تراجع / استعادة | "إهمال" = throw away unsaved or uncommitted changes, "تراجع" = undo a commit |
| keep / unlink (suspect links) | إبقاء / فكّ الربط | |
| remote | الخادم البعيد (adj. بعيد) | |
| schema | المخطط | |
| hierarchy / outline number | التسلسل الهرمي / رقم التسلسل | |
| defect | خلل | (AR-12) |
| status values | مسودة، مراجعة، معتمد، ملغى | Draft, Review, Approved, Obsolete |
| history | سجلّ (with shadda) | (AR-07) |

## Questions for the owner

1. The user guide (`src/shared/guide.ts` / `docs/USER-GUIDE.md`) is English only. Should the Arabic window get an Arabic guide (large job, a later version) or keep the English note?
2. Parent/child words (AR-04): accept "الأب / عنصر فرعي", or keep "الأصل" and choose a different word for children?

## Checked, nothing found

- Same keys as text.ts: compiler enforces; no key is English-only except the intended Latin ones (`reportTitle`, `tidyCommit`, `mergeMessage`, `imported` are Git/report texts and equal the English file).
- Right-to-left mark: added automatically to every string and function result (`marked()`), so none is missing (F).
- Product names (reqochet, Git, GitHub, Excel, ReqIF, CSV, Markdown) stay in Latin letters in every key (F, grep).
- Numbers and values inside sentences (`${n()}`, ids, paths, versions) are placed correctly; Western digits as announced.
- Terms from the glossary (item, requirement, link, suspect, field, type, repository, branch, commit, push, changes, import/export) are used consistently.
- Status and priority option labels in the schema read naturally; type labels (متطلب نظام/برمجيات/عتاد/واجهة) are consistent.
- Screenshot `language-1-arabic.png`: panel order, scrollbar side, back arrow and tab order are mirrored correctly; only the ID cell (AR-11) looks wrong. No other Arabic screenshot exists in `e2e/out/`.
