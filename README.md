# RAIA // PRO

Plataforma para treinadores de natação: montagem de treinos por blocos e zonas de intensidade (Z1–VEL), periodização, gestão de equipes e atletas, painéis analíticos e ficha de treino para impressão.

**Stack:** React 19 + Vite + TypeScript no front-end, [Convex](https://convex.dev) como backend (banco em tempo real e funções). Sem `VITE_CONVEX_URL`, o app roda em **modo local** (localStorage, um único dispositivo).

## Como rodar

```bash
npm install
npx convex dev        # sobe/sincroniza o backend e regenera convex/_generated
npm run dev           # front-end em http://localhost:5173
```

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento do Vite |
| `npm run build` | Type-check + build de produção |
| `npm run typecheck` | Type-check do app e das funções Convex |
| `npm test` | Testes (Vitest + convex-test) |
| `npm run lint` | Oxlint |

## Estrutura

```
convex/            backend (schema, queries, mutations, actions)
  lib/session.ts   resolução de sessão e checagem de dono
  passwords.ts     login/cadastro (Node action: scrypt + tokens aleatórios)
  auth.ts          sessões, bloqueio por tentativas, logout
  *.test.ts        testes do backend com convex-test
src/
  components/      telas (WorkoutBuilder, PlanningManager, AthleteAnalytics...)
  domain/          regras puras: datas locais, tempos de prova, erros
  utils/storage.ts cálculos de treino + persistência do modo local
  data/            catálogo padrão e treinos de exemplo
```

## Segurança (modo nuvem)

- Senhas com **scrypt** e salt aleatório por usuário. Contas antigas (SHA-256 com salt fixo) são migradas automaticamente no próximo login.
- O login cria um **token de sessão** aleatório (validade de 30 dias). O servidor guarda só o hash SHA-256 do token.
- Toda query e mutation recebe `sessionToken`, e o servidor deduz o treinador a partir dele. O `coachId` enviado pelo cliente é ignorado.
- Depois de 5 senhas erradas, a conta fica bloqueada por 15 minutos.
- Cada treinador tem seu próprio catálogo técnico. Excluir uma equipe remove também seus atletas, planos e treinos.

## Convenções

- **Datas** (`YYYY-MM-DD`) usam sempre o dia local: use `todayLocalISO()` / `addDaysISO()` de `src/domain/date.ts`, nunca `toISOString().slice(0, 10)`.
- **Tempos de prova** são validados e normalizados com `parseSwimTime` / `formatSwimTime` de `src/domain/time.ts`, em centésimos internamente.
- **Erros para o usuário** saem do backend como `ConvexError('mensagem')`, porque o Convex oculta a mensagem de `Error` comum em produção. No cliente, leia-os com `getErrorMessage()`.
