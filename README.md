<p align="center"><img src="public/icon.svg" width="88" alt="Ícone do Meu Financeiro"></p>

# Meu Financeiro

[![Validação](https://github.com/DaniellaCfC/meu-financeiro-controle/actions/workflows/validate.yml/badge.svg)](https://github.com/DaniellaCfC/meu-financeiro-controle/actions/workflows/validate.yml)

### Controle financeiro pessoal e empresarial, com acompanhamento de investimentos.

O **Meu Financeiro** reúne contas a pagar e receber, fluxo de caixa, relatórios e investimentos em uma aplicação web. Desenvolvido para apoiar a organização financeira de pessoas físicas e pequenos negócios, permite acompanhar compromissos, registrar quitações e consultar informações por período.

## Funcionalidades

- **Gestão de contas:** cadastro de receitas e despesas, categorias e registro de quitação integral.
- **Parcelamento:** divisão de lançamentos em até 36 parcelas mensais, com prévia de valores e vencimentos.
- **Acompanhamento de vencimentos:** avisos no painel para contas atrasadas, do dia e dos próximos sete dias.
- **Fluxo de caixa:** acompanhamento do saldo e dos compromissos financeiros.
- **Relatórios:** filtros por período, categoria, situação e descrição, com exportação CSV.
- **Histórico de alterações:** edição de contas e reversão de quitação com registro de motivo.
- **Investimentos:** cadastro, acompanhamento e projeções de cenários, com referências públicas do Banco Central para produtos compatíveis.
- **Perfis pessoal e empresarial:** adaptação de textos e categorias conforme o uso.
- **Instalação como aplicativo:** suporte a PWA em navegadores compatíveis.
- **Piloto de assinaturas:** administração de períodos de acesso e link de pagamento, com conferência manual.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | HTML, CSS e JavaScript com módulos ES |
| Servidor | JavaScript em Cloudflare Workers |
| Persistência | Cloudflare D1, SQLite e Drizzle |
| Identidade e hospedagem | Sites |
| Testes | Test runner nativo do Node.js |
| Instalação | Web App Manifest e Service Worker |

## Acesso

[Consultar a aplicação hospedada](https://financeiro-daniella-inicial.daniellafercardoso.chatgpt.site/)

O acesso à instalação atual é restrito aos usuários autorizados. A disponibilização deste código não altera essa permissão.

## Desenvolvimento local

Utilize Node.js com suporte a `node:sqlite` (Node 22.13 ou superior) e pnpm.

```sh
pnpm install --frozen-lockfile
node build.mjs
node dev.mjs
```

Abra `http://127.0.0.1:4173`. A prévia usa uma identidade de teste e um banco SQLite local na pasta `.local/`, separado da instalação hospedada.

Para executar a suíte completa após o build:

```sh
npm test
```

A suíte contém 26 testes de cálculos, persistência, isolamento entre usuários, parcelamento, relatórios, investimentos, assinaturas e PWA. O GitHub Actions executa o build e a suíte a cada envio para a branch principal e em pull requests.

## Estrutura

- `public/`: interface, estilos, instalação e regras compartilhadas.
- `server/`: API e controles de acesso ao piloto de assinaturas.
- `db/` e `drizzle/`: esquema e migrações do banco.
- `*.test.mjs`: testes automatizados.
- `build.mjs`: geração dos arquivos de distribuição.
- `dev.mjs` e `local-db.mjs`: ambiente local de desenvolvimento.

## Implantação

Esta cópia foi preparada para distribuição do código e não contém o banco de produção, credenciais ou o histórico Git da instalação original.

Antes de implantar outra instância, configure o projeto em `.openai/hosting.json` e a identidade administrativa em `server/billing.mjs`, onde foram inseridos marcadores. A autenticação de produção depende da identidade fornecida pelo Sites e de um banco D1 configurado com as migrações.

**GitHub Pages não executa esta aplicação completa**, pois ela possui servidor, autenticação e banco de dados. O GitHub pode hospedar o código e sua documentação; a instalação atual continua hospedada no Sites.

Para experimentar as funcionalidades administrativas e de gravação na prévia local, use temporariamente `local-preview-only` como `ADMIN_OWNER` em `server/billing.mjs` e refaça o build. Essa identidade é exclusiva do ambiente de desenvolvimento; configure a identidade autenticada correta antes de implantar em produção.

## Escopo e limitações

A aplicação requer conexão para consultar e salvar dados. Não há sincronização bancária ou com corretoras, movimentação real de dinheiro, pagamentos parciais nem confirmação automática de assinaturas. Projeções de investimentos representam cenários e não garantem rentabilidade. O produto não substitui um sistema contábil ou fiscal.
