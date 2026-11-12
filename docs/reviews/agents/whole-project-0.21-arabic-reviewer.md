# Arabic reviewer — whole-project-0.21

**Scope.** Frozen commit a8244a2 (the pack names 4c819c1; I read the working files). Part A: I checked every finding of the earlier Arabic reports (`0.17.0` to `0.20.0`, `whole-project-arabic-reviewer.md` AR-01…13 and `whole-project-0.20-arabic-reviewer.md` W1…W15) against the current `src/shared/text-ar.ts` (1323 lines), `src/renderer/src/lib/keys.ts`, `ItemTable.tsx`, `TraceabilityView.tsx` and `config/default-schema.yaml`. Part B: I read the 0.21.1 texts (the 15 «نسخة» texts, `settingsTooltip`, `statusGapsTooltip`, `noProblems`, `upstreamOtherName`, `tooManyRows`, `unsaved*`, `sameIdFiles`, `whichCopy`, `version.opening`) against `text.ts`, grepped `styles.css`-related items from the earlier report and opened `e2e/out/language-1-arabic.png` once. Meaning is kept in all new texts. A right-to-left mark is added to every string by `marked()` (line 1315). In the code below, `iso(x)` is a helper to add at the top of the file: `const iso = (x: string): string => \`⁨${x}⁩\``.

## A. Open items from earlier reports

Status of W1…W15 (0.20 whole-project report):

| ID | Status | Evidence |
| --- | --- | --- |
| W1 | Fixed | 15 texts now «نسخة» (lines 545-546, 828-829, 852, 855, 871, 884, 982-984, 1094-1115…). Remaining «إصدار» are app releases or Git program version (lines 91, 99, 167-178, 691, 1163): correct. |
| W2 | Fixed | line 845 «الفروع وعلامات Git». |
| W3 | **Open** | lines 751, 1131, 1184 (see B1). |
| W4 | **Open** | line 1226 (see B2). |
| W5 | **Open** | line 806 (see B3). |
| W6 | **Open** | lines 262, 513, 612, 770, 876, 981, 991, 1211, 1226 (see B4). |
| W7 | **Open** | «الحاسوب» still at 105, 117, 126, 138, 144, 257, 983, 1120, 1147, 1182; «السمة» at 120 (see B5). |
| W8 | **Open** | «ملف السجلّ» (201, 250) = log file and history are both السجلّ; line 1287 «ملف السجل» has no shadda (see B6). |
| W9 | Fixed | `lib/keys.ts` `arrowDirection`, used in `ItemTable.tsx:217`. |
| W10 | Fixed | `ItemTable.tsx:123` uses `arrowDirection`; hint texts (354, 921) stay valid. |
| W11 | Fixed | `closedMark()` used in ItemTable, ChangesView, SuspectLinksDialog, TraceabilityView, Settings. |
| W12 | **Open** | `TraceabilityView.tsx:339` still `→`/`←` unmirrored; legend line 1018 (see B7). |
| W13 | **Open** | lines 1060, 1249, 1252 (see B8). |
| W14 | Fixed | screenshot: "+ عنصر جديد" is whole, toolbar wraps. |
| W15 | No change needed | same sentence in both keys is intended. |

Earlier reports (`whole-project-arabic-reviewer.md`, cf0cc3c): AR-01 fixed (`pl()` zero case); AR-02, AR-03 fixed (lines 96, 213, 219, 403, 431, 451, 989 use `pl()` and agree); AR-04 settled by the glossary (أصل / عنصر فرعي, kept); AR-05 fixed (no «جلب» left); AR-06 fixed (علامة Git); AR-07 fixed (no «مثلاً»); AR-08 fixed (line 1220 spells the symbols); AR-10 fixed; AR-11 fixed (ID shows whole in the screenshot); AR-12 fixed (خلل, عنوان قسم / معلومات). **Still open:** AR-09 (B9) and AR-13 (B10). Older: 0.17 AR-17-09 «عنوان» kept pending an owner round (not a defect); 0.18 A-04/A-05 closed by the builder; 0.19 and 0.20 reports fully answered.

## B. Findings (open items and new)

| ID | file:line | Severity | What is wrong (F = checked, I = likely) | Suggested fix (exact Arabic) |
| --- | --- | --- | --- | --- |
| B1 (W3) | text-ar.ts:751, 1131, 1184 | Medium | F: adjective or verb after a counted noun does not agree: "3 تغييرات غير مودَع", "3 تغييرات لم تُودَع" is right only for 3-10, "تغييران لم تُودَع" is wrong. | 751: `` `لديك تغييرات غير مودَعة (${n(count)}). ماذا يحدث لها عند التبديل إلى "${b}"؟` `` (drop the `count === 1 ? 'له' : 'لها'`). 1131: `` `لديك تغييرات لم تُودَع بعد (${n(count)}). أتودعها أولًا لتكون جزءًا من خط الأساس — أم تنشئ خط الأساس دونها؟` ``. 1184: `` `تم الدفع${uncommitted > 0 ? ` (التغييرات غير المودَعة، وعددها ${n(uncommitted)}، لم تُضمَّن)` : ''}.` `` |
| B2 (W4) | text-ar.ts:1226 | Low | F: "11 عنصرًا متغيّرة": after a singular accusative the adjective is singular. | Replace `` `${items(count)} متغيّرة` `` with `` `${items(count)} ${count > 10 ? 'متغيّرًا' : 'متغيّرة'}` ``. |
| B3 (W5) | text-ar.ts:806 | Medium | F: `<email>` angle brackets are mirrored in right-to-left text and the name and e-mail fuse. | `` `باسم ⁨${name}⁩ ⁦<${email}>⁩` `` |
| B4 (W6) | text-ar.ts:262, 513, 612, 770, 876, 981, 991, 1211, 1226 | Medium | F: user values (ids, names, paths, branch names, messages) are put into Arabic sentences without isolation; two values side by side fuse, "=" and "+/−" jump. Only trace/baselines/rules were fixed. | 262: `` `"${iso(v)}" ليست قيمة مسموحًا بها في ${iso(field)} (المسموح: ${iso(allowed)}).` ``; 513: `` `إزالة الرابط ${iso(relation)} ${iso(id)}` ``; 612: `` `${iso(value)} (غير مسموح)` ``; 770: `` `${action}: ${iso(value)}` ``; 876: `` `الروابط ⁦+${added} −${removed}⁩` ``; 981: `` `schema.yaml ${iso(path)}: ${iso(message)}` ``; 991: `` `${iso(name)} = ${iso(value)}` ``; 1211: `` `${iso(item)}: لا يمكن حفظ القيمة المكتوبة — ${problems} صحّحها ثم أكمل من جديد.` ``; 1226: start with `` `سُحب من ${iso(source)} ` ``. |
| B5 (W7) | text-ar.ts:105, 117, 120, 126, 138, 144, 257, 983, 1120, 1147, 1182 | Low | F: two words for one idea: «الحاسوب» (11 places) versus «الجهاز» (13 places); «السمة» (120) versus «المظهر» (93, 152). | Replace: «هذا الحاسوب» → «هذا الجهاز»; «على حاسوبك» → «على جهازك» (105); «على حاسوبين» → «على جهازين» (257); «إذا أعاد حاسوبان» → «إذا أعاد جهازان» (983); «والسمة» → «والمظهر» (120). Add «الجهاز» and «المظهر» to the glossary. |
| B6 (W8) | text-ar.ts:201, 203, 250, 1287 | Low | F: «السجلّ» is both the commit history and the app log file; line 1287 «ملف السجل» has no shadda. | 201: `'سجلّ التشغيل'`; 203: `'فتح مجلد سجلّ التشغيل'`; 250: `…كُتبت التفاصيل في سجلّ التشغيل.`; 1287: `…أو اطلب المساعدة مع سجلّ التشغيل.` Glossary: log file = سجلّ التشغيل. |
| B7 (W12) | TraceabilityView.tsx:339; text-ar.ts:1018 | Low | I: the matrix glyphs `→`/`←` are not mirrored. In the Arabic window the row label is at the right and the columns run to the left, so "row links to column" should point left. | In the cell use `out ? (isRtlDocument() ? '←' : '→') : (isRtlDocument() ? '→' : '←')`. Legend (Arabic): start with `'← عنصر الصف يرتبط به · → هو يرتبط بعنصر الصف · ↔ كلاهما · ⚠ …'` (swap only the first two arrows, keep the rest of the line). Confirm in an Arabic matrix screenshot. |
| B8 (W13) | text-ar.ts:1249, 1252 (1060 optional) | Low | F: fixed noun after a number: "في هذا الصف 1 خلايا", "بعد 1 من 2 صفًّا". | 1249: `` `في هذا الصف ${pl(cells, 'خلية واحدة', 'خليتان', 'خلايا', 'خلية')} بينما في العنوان ${n(header)} — ربما قطعت علامة اقتباس (") داخل خلية جزءًا منه. راجع الصف في الملف.` ``; 1252: replace `${done} من ${all} صفًّا` with `` `${n(done)} من ${all === 1 ? 'صف واحد' : all === 2 ? 'صفين' : all <= 10 ? `${n(all)} صفوف` : `${n(all)} صفًّا`}` `` (keep the rest of the sentence). 1060: `cols` is always above the grid limit, no change. |
| B9 (AR-09) | text-ar.ts:1315-1323 | Low | I: `marked()` also puts the invisible mark in `brand.name`, `brand.dev` and single symbols; a code comparison or copy of the brand name would carry it. | Skip `marked()` for keys `brand.name`, `brand.dev`, or add a test that no code compares them. No Arabic text change. |
| B10 (AR-13) | config/default-schema.yaml:57 | Low | I: `relates-to` has «مرتبط بـ» in both directions, and schema labels get no right-to-left mark. | Forward label: `يرتبط بـ` (reverse stays `مرتبط بـ`). For the mark, add U+200F in the one place that reads schema labels in Arabic. |
| B11 (new) | text-ar.ts:50 | Low | F: `unsavedDetail` «ومنها لتثبيت تحديث» is a loose translation of "also to install an update". | `'إذا أُغلقت النافذة الآن (ومنه إغلاقها لتثبيت تحديث) فستضيع هذه التغييرات.'` |
| B12 (new) | text-ar.ts:51 | Low | F: glossary term for discard is «إهمال» (the editor button already reads «إهمال التغييرات»); here «تجاهل». | `'إهمال التغييرات والإغلاق'` |
| B13 (new) | text-ar.ts:66 | Low | I: the headline «متطلبات بإصدارات» uses إصدار for versions of the requirements (glossary: نسخة). English: "versioned like code". | `'متطلبات بنسخ محفوظة، مثل الكود تمامًا.'` (the owner may prefer the common phrase «التحكم بالإصدارات»; marketing text, builder decides). |

**New 0.21.1 texts read and found good:** `settingsTooltip` (55, 698; the chip `+ الإعدادات` matches line 710), `statusGapsTooltip`, `noProblems` (390, 980), `upstreamOtherName` (values isolated, «ادفعه» matches glossary), `tooManyRows` (sheet isolated; the number follows the Latin-digit convention), `unsavedTitle/Message/Keep/Mark/Ask`, `sameIdFiles` and `whichCopy` (grammar and the term «نسخة» for a copied file are right; only the «حاسوب» word, B5), `version.opening` (72, 1100).

**Glossary additions proposed.**
- this computer / device = الجهاز (not الحاسوب); theme = المظهر (not السمة) (B5).
- log file = سجلّ التشغيل; history = السجلّ (B6).
- Rule: an adjective or verb after a counted noun agrees with the count (1 and 11+: masculine singular; 2: dual; 3-10: feminine singular for things); or rephrase with the count in brackets (B1).
- Rule: wrap user values in isolates with `iso()` (B4).

## Questions for the owner

1. B6: is «سجلّ التشغيل» acceptable for the app log file (so السجلّ always means the commit history)?
2. B13: in the welcome headline, نسخ (consistent with the glossary) or the common phrase «الإصدارات»?

## Checked, nothing found

- Key parity and meaning of the 0.21.1 texts against `text.ts`: nothing missing or changed in meaning.
- Plurals via `pl()` for items, changes, links, problems, rows, lines, choices, warnings, results: forms correct (0, 1, 2, 3-10, 11+).
- Arrow keys and ◂ (W-51): `arrowDirection` and `closedMark` are right; the arrows in menu paths («الإعدادات ← الميزات») and back links («رجوع →») point the right way for right-to-left reading.
- Right-to-left mark on every string through `marked()`; product names (reqochet, Git, GitHub, Excel, ReqIF) stay Latin.
- Terms: suspect, pull (سحب), commit (إيداع), branch, baseline, parent/child, defect match the glossary; no «جلب» left.
- Screenshot `language-1-arabic.png`: toolbar wraps, ID column and "+ عنصر جديد" complete, panels, tabs, scrollbar and status bar mirrored; no layout problem seen.
- CSS: not changed since the 0.20 check (logical properties only); I did not find new physical left/right properties in what I read.
