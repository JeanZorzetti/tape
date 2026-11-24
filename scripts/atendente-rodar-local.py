# Rota local genérica: instrução + base em texto + casos -> saídas (Claude Code sem ferramentas, como a Polaris).
# uso: python3 -I rodar.py instrucao.md base.md casos.jsonl saidas.jsonl
import json,subprocess,sys,os,concurrent.futures as cf
CLI=os.path.expanduser('~/.vscode/extensions/anthropic.claude-code-2.1.328-linux-x64/resources/native-binary/claude')
VAZIA=os.path.join(os.path.dirname(os.path.abspath(__file__)),'vazia')
instr,basef,casosf,saidaf=sys.argv[1:5]
instrucao=open(instr).read().strip(); base=open(basef).read().strip()
casos=[json.loads(l) for l in open(casosf) if l.strip()]
def sistema(): return '\n\n'.join([instrucao,'Contato: nome não informado.','Agora: segunda-feira, 14:40 (horário de Brasília).',base+'\n\nUse o que está acima quando a resposta estiver nele; se não estiver, diga que não tem essa informação agora.','Escreva só a mensagem que vai para o cliente no WhatsApp, em português do Brasil.'])
def prompt(conv):
    if len(conv)==1: return conv[0]['texto']
    return 'Conversa até agora:\n\n'+'\n\n'.join(f"{'Cliente' if m['papel']=='cliente' else 'Você'}: {m['texto']}" for m in conv)+'\n\nResponda à última mensagem do Cliente.'
def rodar(c):
    out=''; r=None
    for _ in range(2):
        r=subprocess.run([CLI,'-p',prompt(c['conversa']),'--system-prompt',sistema(),'--model','claude-sonnet-5-5','--tools','','--strict-mcp-config','--setting-sources','','--no-session-persistence','--disable-slash-commands','--effort','low'],cwd=VAZIA,capture_output=True,text=True,timeout=240)
        out=r.stdout.strip()
        if out: break
    return {'id':c['id'],'resposta':out.replace('[[EQUIPE]]','').strip(),'equipe':'[[EQUIPE]]' in out,'erro':None if out else r.stderr[-300:]}
with cf.ThreadPoolExecutor(4) as ex: res=list(ex.map(rodar,casos))
with open(saidaf,'w') as f:
    for x in res: f.write(json.dumps(x,ensure_ascii=False)+'\n')
print('ok',len(res))
