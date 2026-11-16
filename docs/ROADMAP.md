# Raia — Roadmap

Plano de evolução do Raia a partir da Fase 1.

**Fase 0 — concluída (nov/2026):**
- autenticação no servidor, com sessões, hash scrypt e bloqueio após várias tentativas erradas;
- isolamento de dados entre treinadores;
- catálogo técnico por treinador;
- exclusão em cascata ao remover uma equipe;
- correção das datas (fuso local);
- validação dos tempos de prova;
- testes com Vitest e `convex-test`;
- repaginação visual completa.

A ordem das fases segue o impacto para o treinador. Cada fase precisa ser entregável e útil sozinha.

---

## Fase 1 — Desempenho real

> O app hoje mede **o que foi prescrito** (metros, zonas). Esta fase passa a medir **o que aconteceu**: tempos, testes e a carga percebida pelo atleta.

### 1.1 Histórico de tempos e competições
- Nova tabela `results`, com:
  - atleta e prova;
  - piscina (25 ou 50 m);
  - tempo em centésimos e parciais;
  - data e competição;
  - se o tempo é oficial ou de treino.
- Melhor marca calculada automaticamente por prova e por piscina. Os campos `bestTime` e `targetTime` deixam de ser digitados à mão.
- Gráfico de evolução por prova, com a linha da meta.
- Conversão aproximada entre piscina de 25 m e de 50 m.
- **Migração:** converter os `bestTime`/`targetTime` atuais (texto) em centésimos usando `parseSwimTime` (`src/domain/time.ts`).

### 1.2 Pontuação World Aquatics e índices
- Pontos World Aquatics por resultado, calculados a partir da tabela base de cada prova.
- Cadastro de **índices**: federação estadual, CBDA, Troféu Brasil, seletivas. Cada índice tem prova, categoria, piscina e tempo.
- Para cada atleta: "faltam X,XX s para o índice Y".

### 1.3 Teste de CSS (Critical Swim Speed)
- Registro do teste de 400 m e 200 m, com o cálculo do CSS (ritmo de referência por 100 m).
- As zonas Z1–VEL passam a ter **ritmo-alvo individual por 100 m**.
- A ficha impressa mostra o tempo-alvo de cada série por atleta ou por grupo de raia.
- O tempo estimado do treino (`estimateItemSeconds`) deixa de usar o ritmo fixo de 92 s/100 m e passa a usar o ritmo do atleta.

### 1.4 Carga interna (sessão-RPE)
- Depois do treino, o RPE (0–10) é registrado por atleta, pelo técnico ou pelo próprio atleta (ver Fase 2).
- Métricas calculadas:
  - carga = RPE × minutos;
  - ACWR (relação entre carga aguda e crônica);
  - monotonia;
  - strain.
- Essas métricas validadas substituem a heurística atual `predictPhysicalState` na tela Atletas.
- Alertas de ACWR fora da faixa de 0,8 a 1,3.

### 1.5 Wellness diário
- Questionário curto sobre sono, dor muscular, estresse e humor.
- Alerta de risco quando os valores pioram de forma consistente.

**Arquivos principais:**
- `convex/schema.ts`: tabelas `results`, `qualifyingStandards`, `cssTests`, `rpeLogs`, `wellness`;
- `src/domain/`: `points.ts`, `pace.ts` e `load.ts`;
- `src/components/AthleteAnalytics.tsx`;
- `src/components/PrintSheet.tsx`.

**Pronto quando:** dá para registrar um tempo e um teste de CSS, a ficha impressa mostra o ritmo individual, e o ACWR aparece na tela Atletas.

---

## Fase 2 — O atleta como usuário

> Fazer o atleta (e a família) usar o app aumenta a qualidade dos dados e o engajamento.

### 2.1 Portal do atleta
- Acesso por convite, com um link gerado pelo técnico e login próprio.
- O atleta vê:
  - o treino do dia;
  - suas metas;
  - seus tempos e a evolução.
- O atleta registra RPE, wellness e presença.
- **Responsáveis** acompanham atletas menores de idade.
- Papéis no backend (`coach`, `athlete`, `guardian`) com checagem de permissão em `convex/lib/session.ts`.

### 2.2 Chamada rápida na borda da piscina
- Tela própria para tablet: um toque por atleta para marcar presença.
- Opção de check-in por QR code.

### 2.3 Compartilhar treino
- Link público somente leitura, com expiração.
- Botão de compartilhar no WhatsApp com o resumo do treino.

### 2.4 Notificações
- Avisos de treino publicado, competição se aproximando e wellness pendente.

### 2.5 PWA e uso offline
- App instalável e com cache do treino do dia, porque a piscina costuma ter Wi-Fi ruim.
- Os registros feitos sem internet sincronizam quando a conexão volta.

### 2.6 LGPD
- Termo de consentimento do responsável para atletas menores.
- Exportação e exclusão dos dados da conta.

**Pronto quando:** um atleta convidado entra, vê o treino do dia e registra o RPE pelo celular.

---

## Fase 3 — Produtividade do treinador

> Reduzir o tempo gasto para montar e organizar treinos.

### 3.1 Calendário
- Visão semanal e mensal, com arrastar e soltar treinos entre dias.
- Volume planejado × realizado por fase e carga da semana.

### 3.2 Séries aninhadas e digitação rápida
- Séries compostas, como `3x(4x100 @1:30 Z3 + 1x200 Z1)`.
- Um parser de texto gera os itens a partir de linhas como `8x50 borb @50" VEL`.

### 3.3 Biblioteca de modelos
- Treinos e séries favoritos.
- Clonar um microciclo inteiro e aplicar uma fase a várias semanas.

### 3.4 Grupos de raia
- Um mesmo treino com variações de distância e intervalo por grupo (A, B, C).

### 3.5 Modo relógio de piscina
- Tela para TV ou tablet com a série atual, o relógio de saída e a próxima série.

### 3.6 Treino fora d'água
- Força, mobilidade e core entram no cálculo da carga total.

**Pronto quando:** o treinador monta uma semana inteira pelo calendário, a partir de modelos, sem digitar série por série.

---

## Fase 4 — Competição, análise técnica e integrações

### 4.1 Gestão de competições
- Calendário de competições, inscrições por prova e balizamento.
- Importação de resultados.

### 4.2 Análise de prova
- Parciais, frequência de braçada, DPS, tempo de saída e de virada.
- Upload de vídeo com marcação de eventos.

### 4.3 Integrações
- Exportar o treino para Garmin, Apple Watch e óculos FORM (formato .FIT).
- Importar dados do Strava e do Apple Health.
- Importar resultados das federações.

### 4.4 Assistente com IA
- Gerar um treino a partir do objetivo, da fase, do volume e dos equipamentos disponíveis.
- Sugerir ajustes de carga com base no ACWR.
- Resumir a semana da equipe.

---

## Fase 5 — Plataforma e negócio

- **Clube com vários treinadores:** papéis de técnico principal, assistente e preparador físico.
- **Gestão do clube:** mensalidades e atestados médicos com alerta de vencimento.
- **Relatórios:** exportação em PDF e Excel para diretoria e patrocinadores.
- **Idiomas:** inglês e espanhol.

---

## Dívida técnica (tratar ao longo das fases)

- **Paginação da lista de treinos.** Hoje a lista inteira é carregada para alimentar o Painel e a tela Atletas. O ideal é calcular as métricas no backend ou guardar agregados.
- **Persistência única.** O código mantém dois caminhos, nuvem (Convex) e modo local. Unificar numa interface `Repository`, ou trocar o modo local pelo PWA offline (Fase 2.5).
- **Componentes grandes.** Quebrar os componentes de 900 a 1.200 linhas (`AthleteAnalytics`, `PlanningManager`, `WorkoutBuilder`): mover cálculos para hooks em `src/domain/` e criar componentes de gráfico reutilizáveis.
- **Estilos inline.** Substituir os restantes pelas classes e tokens do novo design.
- **Testes de componentes.** Adicionar testes para os fluxos principais: criar treino, concluir e registrar faltas.
