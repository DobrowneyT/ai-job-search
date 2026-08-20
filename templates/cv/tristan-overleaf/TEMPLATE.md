# Template: tristan-overleaf

- **Type:** CV
- **Engine:** pdflatex
- **Page limit:** 2 pages
- **Fonts:** XCharter (TeX-distribution package `xcharter` - must be installed, e.g. via texlive-fonts-extra)
- **Class/packages:** `article` class; geometry, XCharter, fontenc, inputenc, enumitem, hyperref, titlesec (all standard TeX Live/MiKTeX packages)

## Compile command

    cd <output dir> && pdflatex -interaction=nonstopmode <file>.tex

## Style rules

- Single-column, letterpaper, 0.5in margins on all sides, `\raggedright`, no page numbers.
- Centered `\Huge` name header, then a centered contact line of `|`-separated `\href` links (email, optional portfolio, GitHub). Contact details must appear as literal text, not icons.
- Section headings via `\section*{}`: bold, `\large`, with a `\titlerule` underneath (configured in the preamble `\titleformat` - do not restyle per-section).
- Section order: Profile, Skills, Experience, Projects, Student Groups (optional), Education, Awards.
- Skills section is `\textbf{Category:} list` lines separated by `\\`, not a bulleted list.
- Each Experience/Project entry: bold title line with `\hfill`-right-aligned dates (or URL for projects), then `\vspace{-9pt}` followed by an `itemize` of achievement bullets.
- Date ranges use `--` (en dash), e.g. `May 2024 -- December 2025`.
- Spacing rhythm is deliberate and fragile: `\vspace{-6.5pt}` after Profile/Skills, `\vspace{-18.5pt}` after each itemize-ending section, `\vspace{-9pt}` between an entry title and its bullets. Preserve these values; adjust `topsep` in `\setlist` only as a last resort.
- Engine must be pdflatex: the preamble uses the pdfTeX-specific `\pdfgentounicode=1` + `glyphtounicode` for an ATS-readable text layer. Do not switch to xelatex/lualatex.

## Known pitfalls

- The negative `\vspace` values assume each section ends with an `itemize`. A section that ends in plain text (like Education) must NOT be followed by `\vspace{-18.5pt}` or headings will overlap.
- Special characters in content (`#`, `$`, `%`, `&`, `_`) must be escaped (`\#`, `\$`, `\%`, `\&`, `\_`); C# must be written `C\#`.
- `\pdfgentounicode` fails on xelatex/lualatex - compile errors mentioning undefined `\pdfgentounicode` mean the wrong engine was used.
