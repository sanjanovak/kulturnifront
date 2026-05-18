# Analiza društvenih mreža i kolaboracijskih struktura u udruzi Kulturni front

**Autor:** Sanja Novak
**Datum:** 18. svibanj 2026.
**Institucija:** Nezavisno istraživanje u okviru Network Metrics Dashboard projekta

---

## Sažetak (Abstract)

Ovaj izvještaj predstavlja znanstvenu analizu dinamike društvenih mreža unutar udruge Kulturni front, koristeći napredne algoritme teorije grafova implementirane kroz Network Metrics Visualizer aplikaciju. Analiza se fokusira na razlikovanje odnosa proizašlih iz organizacijskih aktivnosti naspram onih proizašlih iz pukog sudjelovanja na događajima. Kroz metriku centralnosti (Degree, Betweenness, Eigenvector), rad identificira ključne aktere ("hubove") i posrednike koji osiguravaju protok informacija i koheziju unutar udruge. Rezultati sugeriraju čvrstu povezanost unutar organizacijskih jezgri, dok sudjelovanje pokazuje širinu, ali manju gustoću mreže.

---

## 1. Uvod

Udruga Kulturni front predstavlja složen sustav u kojem suradnja nadilazi formalne strukture. Socijalna mrežna analiza (SNA - Social Network Analysis) omogućuje nam da vizualiziramo i kvantificiramo te nevidljive niti suradnje. Cilj ovog rada je istražiti kako specifični događaji (eventi) oblikuju mrežu poznanstava i suradnji, te kako uloga u organizaciji utječe na poziciju pojedinca unutar društvenog grafa.

## 2. Metodologija

### 2.1 Prikupljanje podataka
Podaci su generirani putem Google Sheets dokumenta (`1TqRayTN2RE8...`) koji bilježi interakcije članova tijekom različitih projekata udruge. Podaci su kategorizirani prema tipu aktivnosti (Organizacija vs. Sudjelovanje) i specifičnom događaju (npr. Liburnicon, team building, radionice).

### 2.2 Instrumentalizacija
Za analizu je korišten razvijeni "Network Metrics Visualizer" stog:
- **Backend:** Google Sheets API za sinkronizaciju podataka.
- **Analitički moduli:** Proračuni centralnosti stupnja (Degree), centralnosti bliskosti (Closeness) i centralnosti posredovanja (Betweenness).
- **Vizualizacija:** Recharts biblioteka za mapiranje klastera (kategorija).

### 2.3 Određivanje metrika
- **Stupanj (Degree):** Broj ljudi s kojima je pojedinac izravno surađivao.
- **Težinski stupanj (Weighted Degree):** Intenzitet suradnje (učestalost zajedničkog rada na više projekata).
- **Svojstvena centralnost (Eigenvector):** Ne gleda samo koliko ljudi poznajete, već koliko su ti ljudi "važni" u mreži.

## 3. Rezultati

### 3.1 Organizacijska struktura vs. Sudjelovanje
Analiza pokazuje jasnu bifurkaciju mreže:
1.  **Organizacijski klasteri:** Karakterizirani su visokim vrijednostima *Betweenness* centralnosti. Ovi pojedinci djeluju kao mostovi (gatekeepers) koji povezuju različite sekcije udruge.
2.  **Klasteri sudjelovanja:** Pokazuju visoku distribuciju *Degree* metrike, ali niži *Betweenness*. To ukazuje na široku bazu članstva koja je dobro povezana unutar svojih interesnih skupina, ali se rjeđe miješa s drugim sekcijama.

### 3.2 Dinamika po događajima
Svaki event unutar udruge stvara privremeni klaster. Vidljivo je da se najveća suradnja (tko s kim najviše surađuje) događa u fazi pripreme velikih manifestacija, gdje *Eigenvector* centralnost raste kod koordinatora volontera.

## 4. Rasprava

Rezultati ukazuju na to da je Kulturni front "mreža malog svijeta" (small-world network). Većina članova može dosegnuti bilo kojeg drugog člana preko najviše dva do tri posrednika u organizacijskom timu. Visoka korelacija između *Betweenness* i *Eigenvector* metrika (vidljiva na Scatter grafikonu aplikacije) potvrđuje hipotezu da su najaktivniji organizatori ujedno i najutjecajniji komunikatori.

## 5. Zaključak

Ova aplikacija omogućuje udruzi Kulturni front da prepozna potencijalno "izolirane" članove i ojača suradnju između sekcija. Jasna distinkcija između organizacije i sudjelovanja pomaže u identifikaciji novih lidera – onih koji imaju visoku centralnost u sudjelovanju, ali još nisu integrirani u organizacijske mostove. Budući rad trebao bi uključiti vremensku analizu (temporal SNA) kako bi se pratilo kako se ovi odnosi razvijaju kroz godine.

---

## 6. Literatura (References)

- Barabási, A. L. (2016). *Network Science*. Cambridge University Press.
- Newman, M. (2018). *Networks*. Oxford University Press.
- Scott, J. (2017). *Social Network Analysis*. SAGE Publications.
- Wasserman, S., & Faust, K. (1994). *Social Network Analysis: Methods and Applications*. Cambridge University Press.
