PAINEL DE CRESCIMENTO MENSAL

Arquivos:
- index.html
- style.css
- script.js

Integração:
- O projeto já está conectado ao Apps Script informado.
- Link usado no script.js:
  https://script.google.com/macros/s/AKfycbzKJHTPCRr6cpS557vyPhQd965MQg0-TjgHiBJd5tuB4XOEOGL6B_z-Mdrxu9MqKv7e/exec

Como funciona:
1. Abra o arquivo index.html no navegador.
2. O painel busca os dados automaticamente no Google Sheets via Apps Script.
3. A primeira coluna compara o mês escolhido usando a aba Vendas.
4. A segunda coluna compara com a aba do mês atual, por exemplo Julho.
5. O painel calcula o crescimento diário e o crescimento total.

Observações:
- Corrigido o final do link para /exec.
- Os cards superiores foram centralizados e deixados com a mesma largura das colunas.
- As colunas usam a mesma grade para manter as linhas paralelas.
- Se o Apps Script falhar, o painel mantém funcionamento local como fallback.

Atualização desta versão:
- A área de fechamento semanal agora abre por um botão no topo.
- A tela semanal abre dentro da mesma página, sem redirecionar e sem abrir nova aba.
- Incluído botão para voltar ao painel principal.
