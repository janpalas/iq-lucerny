# iq-lucerny

Webová aplikace na procvičování logických úloh „Lucerny“ a „Matice“. Typ úloh se volí
v záhlaví stránky. Čisté HTML/CSS/JS bez build kroku – běží přímo na GitHub Pages.

## Pravidla – Lucerny

- Do sítě rozmísti co nejméně luceren tak, aby byla nasvícena všechna volná pole.
- Lucerna svítí nahoru, dolů, doleva a doprava až ke zdi (ne diagonálně).
- Světlo nesmí dopadnout na hlídače.
- Lucerny nesmí svítit proti sobě.
- Každá úloha má právě jedno řešení s minimálním počtem luceren.

## Spuštění lokálně

```bash
python3 -m http.server 8000
```

a otevřít <http://localhost:8000>.

## Nasazení na GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → větev `main`, složka `/ (root)`.

## Úlohy

Úlohy jsou v `puzzles.js` a generuje je `tools/generate.mjs` (Node.js 18+):

```bash
node tools/generate.mjs [seed]
```

Generátor náhodně staví mřížky a pomocí `tools/solver.mjs` ponechá jen ty, které mají
právě jedno řešení s minimálním počtem luceren. Obtížnost se odvozuje od velikosti sítě
a náročnosti prohledávání.

## Matice

Řada nebo mřížka 3×3 obrázků, které se mění podle skrytého pravidla (tvar, počet, výplň,
otočení, poloha, skládání čar…). Jeden obrázek chybí a hráč vybírá správný z možností A–E.
Po vyhodnocení se zobrazí vysvětlení pravidla.

Úlohy generuje `matrix-puzzles.js` přímo v prohlížeči z pevného semínka, takže sada je pro
všechny stejná (36 úloh: 12 lehkých, 12 středních, 12 těžkých). Nové typy pravidel se
přidávají do objektu `FAMILIES` a do plánu `PLAN`; vykreslování obrázků je v `matrix.js`.
