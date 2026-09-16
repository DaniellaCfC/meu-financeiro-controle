# Meu Financeiro

### Gestão financeira pessoal e empresarial, com acompanhamento de investimentos.

O **Meu Financeiro** reúne contas a pagar e receber, fluxo de caixa, relatórios e investimentos em uma aplicação web. Desenvolvido para apoiar a organização financeira de pessoas físicas e pequenos negócios, permite acompanhar compromissos, registrar quitações e consultar informações por período.

[**Acessar o Meu Financeiro**](https://financeiro-daniella-inicial.daniellafercardoso.chatgpt.site/)

> A instalação atual tem acesso restrito aos usuários autorizados.

## Funcionalidades

| Recurso | O que você pode fazer |
| --- | --- |
| Contas a pagar e receber | Organizar receitas, despesas, categorias e quitações integrais. |
| Parcelamento | Dividir lançamentos em até 36 parcelas mensais, com prévia de valores e vencimentos. |
| Vencimentos | Consultar avisos de contas atrasadas, do dia e dos próximos sete dias. |
| Fluxo de caixa | Acompanhar saldo e compromissos financeiros. |
| Relatórios | Filtrar por período, categoria, situação e descrição, com exportação CSV. |
| Histórico | Consultar alterações e registrar motivos de edição ou reversão de quitação. |
| Investimentos | Cadastrar investimentos e consultar projeções de cenários. |
| Perfis | Adaptar textos e categorias ao uso pessoal ou empresarial. |
| Instalação | Adicionar o aplicativo ao computador ou celular em navegadores compatíveis. |

## Para quem foi desenvolvido

- Pessoas que desejam organizar suas finanças pessoais.
- Profissionais autônomos que precisam acompanhar receitas e despesas.
- Empreendedores e pequenos negócios que buscam mais clareza financeira.

## Tecnologias do projeto

| Camada | Tecnologias |
| --- | --- |
| Interface | HTML, CSS e JavaScript com módulos ES |
| Servidor | JavaScript em Cloudflare Workers |
| Persistência | Cloudflare D1, SQLite e Drizzle |
| Identidade e hospedagem | Sites |
| Testes | Test runner nativo do Node.js |
| Instalação | Web App Manifest e Service Worker (PWA) |

## Qualidade e validação

O código recuperado do projeto foi validado localmente com **26 testes automatizados**, abrangendo cálculos, persistência, isolamento entre usuários, parcelamento, relatórios, investimentos, assinaturas e PWA.

## Escopo da aplicação

A aplicação requer internet para consultar e salvar dados. Não realiza movimentações bancárias nem sincronização com bancos ou corretoras. Projeções de investimentos representam cenários e não garantem rentabilidade. O produto não substitui um sistema contábil ou fiscal.

## Sobre este repositório

Este repositório apresenta o Meu Financeiro. A publicação dos arquivos de código está em preparação. O banco de dados financeiro e as credenciais da instalação não fazem parte da publicação.
