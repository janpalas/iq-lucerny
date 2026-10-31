# iq-lucerny

Webová aplikace na procvičování logické úlohy „Lucerny“. Čisté HTML/CSS/JS bez
build kroku – běží přímo na GitHub Pages.

## Pravidla

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
