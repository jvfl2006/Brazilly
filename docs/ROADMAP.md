# Brazilly — backlog de produto e moderação

Este arquivo acompanha funcionalidades planejadas. Um item só deve ser marcado como concluído depois de implementação e teste real com duas contas.

## Em implementação
- [~] Campos de profissão, religião/crença e situação de relacionamento no perfil.
- [~] Link para o teste 16Personalities durante o cadastro.
- [~] Catálogo pesquisável de municípios via API oficial do IBGE.
- [~] Interesses personalizados ("Outro").
- [~] Solicitações de amizade, aceitação e recusa.
- [~] Favoritos privados por usuário.
- [~] Bloqueio com remoção das relações sociais e bloqueio de mensagens.
- [~] Abrir perfil a partir de uma conversa.
- [ ] Privacidade completa do perfil, incluindo armazenamento privado e URLs assinadas para fotos. Não expor o controle ao usuário antes dessa etapa.

## Mensagens
- [ ] Reorganizar a aba de mensagens com estrutura inspirada no WhatsApp: lista, busca, arquivadas, fixadas e menus de conversa.
- [ ] Mostrar não lidas, entregue e lida.
- [ ] Envio de imagens com escolha de qualidade.
- [ ] Pré-visualização desfocada e confirmação para revelar mídia recebida.
- [ ] Figurinhas, emojis e GIFs.
- [ ] Áudios.
- [ ] Wallpaper individual por conversa.
- [ ] Responder, encaminhar e apagar mensagens.
- [ ] Grupos e comunidades.

## Descoberta e privacidade
- [ ] Geolocalização com distância aproximada e filtro por raio.
- [ ] Cidades brasileiras com pesquisa por digitação (catálogo IBGE iniciado).
- [ ] Perfis privados com controle de acesso também aos arquivos de mídia.
- [ ] Modo visitante sem login, limitado a conteúdo público e sem interação.

## Moderação e administração — NÃO ESQUECER
- [ ] Criar painel administrativo separado e protegido por autorização de servidor, nunca por um simples botão escondido no frontend.
- [ ] Fila de denúncias com motivo, detalhes, perfil denunciado, histórico e estado.
- [ ] Ações de moderador: advertir, suspender temporariamente, banir, remover conteúdo e reverter punições.
- [ ] Registro de auditoria para cada ação administrativa.
- [ ] Ferramentas para contestação/revisão de punições.
- [ ] Regras de escalonamento e proteção contra denúncias abusivas.

## Critério de conclusão
Cada recurso deve ser testado em pelo menos duas contas distintas, incluindo permissões, bloqueios, erros de rede e comportamento em celular. Código compilando não significa funcionalidade pronta.
