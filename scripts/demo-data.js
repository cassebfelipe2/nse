/**
 * Phacolog — Script de dados demo
 * Cole no console do navegador em https://cassebfelipe2.github.io/nse/
 * Gera 125 cirurgias variadas. Pergunta se deve substituir ou acrescentar aos dados existentes.
 */
(function () {
  var existentes = [];
  try {
    var raw = localStorage.getItem('cataractadb_res_v1');
    if (raw) existentes = JSON.parse(raw) || [];
  } catch(e) { existentes = []; }

  var modo;
  if (existentes.length > 0) {
    modo = confirm(
      'Você já tem ' + existentes.length + ' cirurgia(s) salva(s).\n\n' +
      'OK  → ACRESCENTAR as 125 cirurgias demo aos dados existentes\n' +
      'Cancelar → SUBSTITUIR tudo pelos dados demo'
    ) ? 'append' : 'replace';
    if (modo === 'replace' && !confirm('Tem certeza? Os dados atuais serão perdidos.')) return;
  } else {
    modo = 'replace';
  }

  /* ── POOLS DE DADOS ─────────────────────────────────────────── */
  var PRIMEIROS = ['Ana','Carlos','Maria','João','Pedro','Francisca','Antônio','Luiza','José',
    'Fernanda','Paulo','Beatriz','Rodrigo','Mariana','Felipe','Juliana','Rafael','Camila',
    'Gabriel','Letícia','Bruno','Isabela','Gustavo','Larissa','Thiago','Natália','Eduardo',
    'Renata','Marcelo','Patrícia','Sônia','Manoel','Rosa','Geraldo','Conceição','Raimundo'];

  var SOBRENOMES = ['Silva','Santos','Oliveira','Souza','Costa','Pereira','Ferreira','Alves',
    'Pinto','Rodrigues','Lima','Gomes','Martins','Rocha','Barbosa','Carvalho','Araújo',
    'Nascimento','Mendes','Moreira','Nunes','Cavalcanti','Freitas','Lopes','Monteiro'];

  var SUPERVISORES = [
    'Prof. Dr. Marcos Veríssimo','Dra. Cláudia Faria',
    'Dr. Henrique Torres','Prof. Dr. Augusto Brandão',
    'Dra. Simone Leal','Dr. Paulo Sérgio Maia'
  ];

  var TECNICAS  = ['Faco','Faco','Faco','Faco','Faco','Faco','Faco','Faco','MSICS','MSICS','Extra'];
  var APARELHOS_FACO  = ['Intuitiv','Intuitiv','Intuitiv','Signature','Signature','Faros','Centurion','Centurion'];
  var APARELHOS_MSICS = ['Centurion','Outro'];
  var OLHOS     = ['OD','OD','OD','OE','OE','OE'];
  var ANEST     = ['Bloqueio','Bloqueio','Bloqueio','Bloqueio','Tópica','Tópica','Sedação','Geral'];
  var CONVENIOS = ['SUS','SUS','SUS','SUS','SUS','SUS','Particular','Unimed','Bradesco','SulAmérica'];

  var CAT_GRAUS = ['N2','N2CP1','N2SCP1','N3','N3CP2','N3SCP1','N3SCP2','N3P1','N4','N4P2',
    'TOTAL BRANCA','TOTAL BRANCA','Brunescente','N2','N3','N3SCP1'];

  var LIO_MODELOS = [
    'Hoya iSert 250','Hoya iSert 250','Hoya Vivinex iSert','Hoya iSert PC-60AD',
    'Alcon AcrySof IQ SN60WF','Alcon AcrySof Toric SN6AT3','Alcon PanOptix TFNT00',
    'TECNIS ZCB00 1-Piece','TECNIS ZCT150 Toric','TECNIS Synergy','TECNIS Multifocal ZMB00',
    'Rayner C-flex 570C','Rayner Toric C-flex','Rayner RayOne Hydrophobic',
    'Zeiss CT LUCIA 611P','Zeiss AT TORBI 709M','Zeiss AT LISA tri 839MP',
    'Bausch+Lomb enVista MX60','Bausch+Lomb SofPort AO'
  ];
  var LIO_TIPOS = ['Monofocal','Monofocal','Monofocal','Tórica','Multifocal','EDOF','Premium'];
  var LIO_MATS  = ['Hidrofóbico','Hidrofóbico','Hidrofóbico','Hidrofílico'];

  var INTERCORRENCIAS = [
    'Ruptura de cápsula posterior',
    'Prolapso de vítreo',
    'Quebra de núcleo',
    'Miose intraoperatória progressiva',
    'Zonulodiálise',
    'Iridodiálise',
    'Sangramento supracoroideo',
    'Edema de córnea intraoperatório',
    'Perda de fragmento para vítreo'
  ];

  var OBS_PREOP = [
    'Midríase boa, paciente colaborativa',
    'Midríase regular, uso de expansor pupilar',
    'Fundo laranja, boa midríase',
    'Pseudoexfoliação, midríase difícil',
    'Glaucoma prévio, PIO controlada',
    'Diabético, midríase ruim',
    'Córnea com discreta opacidade periférica',
    'Sinéquias posteriores, liberadas no ato',
    'Paciente agitada, sedação complementada',
    ''
  ];

  var CONDUTAS_D1 = [
    'Tobramicina + Dexametasona 4×/dia',
    'Moxifloxacino + Dexametasona 4×/dia',
    'Prednisolona 1% 4×/dia + cetorolaco 3×/dia',
    'Manter colírios conforme prescrição',
    'Anti-inflamatório oral + colírios padrão',
    'Retornar em 7 dias para avaliação'
  ];
  var CONDUTAS_D7 = [
    'Reduzir corticoide — 2×/dia por mais 2 semanas',
    'Manter prednisolona 1% 2×/dia',
    'Continuar com colírios, reduzir progressivamente',
    'Iniciar lubricante ocular',
    'Retornar em 30 dias'
  ];
  var CONDUTAS_D30 = [
    'Alta do programa — colírio de manutenção',
    'Alta — retornar em 6 meses se necessário',
    'Encaminhar para refração',
    'Manter lubricante ocular diário',
    'Alta com óculos de leitura indicados',
    'Retornar em 3 meses para reavaliação'
  ];

  var AV_PRE  = ['CD 3m','CD 2m','CD 1m','MM','PL','20/400','20/200','20/100','20/60','20/40'];
  var AV_POS  = ['20/400','20/200','20/100','20/60','20/40','20/30','20/25','20/20'];
  var AV_AVCC = ['20/40','20/30','20/25','20/20','20/15','20/20+'];
  var CORNEAS = ['Clara','Clara','Edema leve','Edema moderado','Estrias de Descemet'];
  var REFS_D30 = ['plano','esf -0.50','esf +0.50','esf -1.00','esf +1.00',
    '-0.75 -0.25 x 90°','-0.50 -0.50 x 180°','esf -0.25',''];

  /* ── HELPERS ────────────────────────────────────────────────── */
  function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function rndInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function rndBool(p) { return Math.random() < p; }

  var hoje = new Date();
  function diasAtras(n) {
    var d = new Date(hoje);
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }
  function maisNDias(iso, n) {
    var d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  }
  function pront(i) {
    return 'HU-' + String(200000 + i).padStart(6, '0');
  }
  function tel() {
    return '(' + rndInt(11,99) + ') 9' + rndInt(1000,9999) + '-' + rndInt(1000,9999);
  }
  function nome() {
    return rnd(PRIMEIROS) + ' ' + rnd(SOBRENOMES) + ' ' + rnd(SOBRENOMES);
  }

  /* ── GERADOR ────────────────────────────────────────────────── */
  var db = [];
  var baseId = Date.now() - 125000;

  // Garante que todos os cenários relevantes existam
  var cenarios = [
    // cenários garantidos para cobrir todas as features
    { tecnica:'Extra',  aparelho:'Outro',     catGrau:'TOTAL BRANCA', compl:false, lioModelo:'',                    lioTipo:'',          lioMat:'',          dias:150 },
    { tecnica:'MSICS',  aparelho:'Centurion',  catGrau:'TOTAL BRANCA', compl:true,  lioModelo:'Hoya iSert 250',      lioTipo:'Monofocal', lioMat:'Hidrofóbico', dias:120 },
    { tecnica:'Faco',   aparelho:'Faros',      catGrau:'N4P2',         compl:true,  lioModelo:'TECNIS Synergy',      lioTipo:'EDOF',      lioMat:'Hidrofóbico', dias:90  },
    { tecnica:'Faco',   aparelho:'Intuitiv',   catGrau:'N3SCP1',       compl:false, lioModelo:'Alcon PanOptix TFNT00', lioTipo:'Multifocal', lioMat:'Hidrofóbico', dias:60 },
    { tecnica:'Faco',   aparelho:'Signature',  catGrau:'Brunescente',  compl:true,  lioModelo:'Zeiss AT LISA tri 839MP', lioTipo:'Multifocal', lioMat:'Hidrofóbico', dias:45 },
    { tecnica:'MSICS',  aparelho:'Outro',      catGrau:'N4',           compl:false, lioModelo:'Hoya iSert PC-60AD',  lioTipo:'Monofocal', lioMat:'Hidrofílico', dias:30  },
    { tecnica:'Faco',   aparelho:'Centurion',  catGrau:'N2',           compl:false, lioModelo:'Alcon AcrySof Toric SN6AT3', lioTipo:'Tórica', lioMat:'Hidrofóbico', dias:14 },
    { tecnica:'Faco',   aparelho:'Intuitiv',   catGrau:'N3CP2',        compl:true,  lioModelo:'TECNIS ZCT150 Toric', lioTipo:'Tórica',    lioMat:'Hidrofóbico', dias:7   }
  ];

  for (var ci = 0; ci < cenarios.length; ci++) {
    var c = cenarios[ci];
    var surgDate = diasAtras(c.dias);
    var posOps = {};

    if (c.dias >= 1) {
      posOps.D1 = { data: maisNDias(surgDate,1), av: rnd(AV_POS), avcc: rnd(AV_AVCC),
        pio: String(rndInt(10,22)), ref:'', ca:'', cornea: rnd(CORNEAS),
        obs:'', conduta: rnd(CONDUTAS_D1), proximoRetorno:'7 dias' };
    }
    if (c.dias >= 7) {
      posOps.D7 = { data: maisNDias(surgDate,7), av: rnd(AV_POS), avcc: rnd(AV_AVCC),
        pio: String(rndInt(10,18)), ref:'', ca:'', cornea:'Clara',
        obs:'', conduta: rnd(CONDUTAS_D7), proximoRetorno:'30 dias' };
    }
    if (c.dias >= 30) {
      posOps.D30 = { data: maisNDias(surgDate,30), av: rnd(AV_AVCC), avcc: rnd(AV_AVCC),
        pio: String(rndInt(10,16)), ref: rnd(REFS_D30), ca:'', cornea:'Clara',
        obs:'', conduta: rnd(CONDUTAS_D30), proximoRetorno: rnd(['Alta','3 meses','6 meses']) };
    }

    db.push({
      id: String(baseId + ci),
      nome: nome(), dataCirurgia: surgDate,
      idade: String(rndInt(45,88)), prontuario: pront(ci+1), telefone: tel(),
      convenio: rnd(CONVENIOS), olho: rnd(OLHOS),
      tecnica: c.tecnica, aparelho: c.aparelho,
      orientacao: rnd(SUPERVISORES), anestesia: rnd(ANEST),
      catGrau: c.catGrau, obsPreOp: rnd(OBS_PREOP),
      lioModelo: c.lioModelo, lioPoder: c.lioModelo ? String(rndInt(140,280)/10) : '',
      lioTipo: c.lioTipo, lioMat: c.lioMat,
      avPre: rnd(AV_PRE),
      intercorrencias: c.compl ? [rnd(INTERCORRENCIAS)] : ['Sem intercorrências'],
      obsIntra: c.compl ? rnd(['Manejo com vitrectomia anterior','IOL implantada em sulco','Conversão para MSICS','Pupila expandida — dispositivo mecânico','']) : '',
      mental: { confianca: rndInt(2,5), controle: rndInt(2,5), estresse: rndInt(1,5), obs:'' },
      cirurgiao: 'Residente Demo',
      posOps: posOps
    });
  }

  // Restante — gerados aleatoriamente até 125
  for (var i = cenarios.length; i < 125; i++) {
    var diasAgo = rndInt(1, 180);
    var sDate   = diasAtras(diasAgo);
    var tec     = rnd(TECNICAS);
    var apar    = tec === 'Faco' ? rnd(APARELHOS_FACO) : tec === 'MSICS' ? rnd(APARELHOS_MSICS) : 'Outro';
    var hasC    = rndBool(0.12);
    var lioM    = tec !== 'Extra' ? rnd(LIO_MODELOS) : '';
    var lioT    = lioM ? rnd(LIO_TIPOS) : '';
    var lioMat  = lioM ? (lioT === 'Tórica' || lioT === 'Multifocal' ? 'Hidrofóbico' : rnd(LIO_MATS)) : '';
    var lioPow  = lioM ? String(Math.round(rndInt(100,280)/10*10)/10) : '';
    var posO    = {};

    if (diasAgo >= 1 && rndBool(0.82)) {
      posO.D1 = { data: maisNDias(sDate,1), av: rnd(AV_POS), avcc: rnd(AV_AVCC),
        pio: String(rndInt(10,24)), ref:'', ca:'', cornea: rnd(CORNEAS),
        obs:'', conduta: rnd(CONDUTAS_D1), proximoRetorno:'7 dias' };
    }
    if (diasAgo >= 7 && rndBool(0.65)) {
      posO.D7 = { data: maisNDias(sDate,7), av: rnd(AV_POS), avcc: rnd(AV_AVCC),
        pio: String(rndInt(10,20)), ref:'', ca:'', cornea: rnd(['Clara','Clara','Edema leve']),
        obs:'', conduta: rnd(CONDUTAS_D7), proximoRetorno:'30 dias' };
    }
    if (diasAgo >= 30 && rndBool(0.44)) {
      posO.D30 = { data: maisNDias(sDate,30), av: rnd(AV_AVCC), avcc: rnd(AV_AVCC),
        pio: String(rndInt(10,17)), ref: rnd(REFS_D30), ca:'', cornea:'Clara',
        obs:'', conduta: rnd(CONDUTAS_D30), proximoRetorno: rnd(['Alta','3 meses','6 meses','1 ano']) };
    }

    db.push({
      id: String(baseId + i),
      nome: nome(), dataCirurgia: sDate,
      idade: String(rndInt(42,91)), prontuario: pront(i+1), telefone: tel(),
      convenio: rnd(CONVENIOS), olho: rnd(OLHOS),
      tecnica: tec, aparelho: apar,
      orientacao: rnd(SUPERVISORES), anestesia: rnd(ANEST),
      catGrau: rnd(CAT_GRAUS), obsPreOp: rnd(OBS_PREOP),
      lioModelo: lioM, lioPoder: lioPow, lioTipo: lioT, lioMat: lioMat,
      avPre: rnd(AV_PRE),
      intercorrencias: hasC ? [rnd(INTERCORRENCIAS)] : ['Sem intercorrências'],
      obsIntra: hasC ? rnd(['Manejo com vitrectomia anterior','IOL em sulco','Conversão para MSICS','Pupila expandida com dispositivo','']) : '',
      mental: { confianca: rndInt(1,5), controle: rndInt(1,5), estresse: rndInt(1,5), obs:'' },
      cirurgiao: 'Residente Demo',
      posOps: posO
    });
  }

  /* ── SALVAR ─────────────────────────────────────────────────── */
  var final = modo === 'append' ? existentes.concat(db) : db;
  localStorage.setItem('cataractadb_res_v1', JSON.stringify(final));
  if (modo === 'replace') localStorage.removeItem('cataractafila_res_v1');

  /* ── RELATÓRIO ──────────────────────────────────────────────── */
  var comCompl  = db.filter(function(s){ return s.intercorrencias[0] !== 'Sem intercorrências'; }).length;
  var comD30    = db.filter(function(s){ return s.posOps && s.posOps.D30; }).length;
  var comD1     = db.filter(function(s){ return s.posOps && s.posOps.D1;  }).length;
  var facos     = db.filter(function(s){ return s.tecnica === 'Faco';  }).length;
  var msics     = db.filter(function(s){ return s.tecnica === 'MSICS'; }).length;
  var extras    = db.filter(function(s){ return s.tecnica === 'Extra'; }).length;

  console.log([
    '✓ 125 cirurgias demo carregadas!',
    '  Técnicas: Faco ' + facos + ' · MSICS ' + msics + ' · Extra ' + extras,
    '  Intercorrências: ' + comCompl + ' casos',
    '  Com retorno D1: ' + comD1 + '  |  D30 completo: ' + comD30,
    '',
    '  Recarregue a página para ver os dados.'
  ].join('\n'));

  var acao = modo === 'append' ? 'acrescentadas aos seus dados' : 'carregadas (dados anteriores substituídos)';
  alert('✓ 125 cirurgias demo ' + acao + '!\n\nRecarregue a página (F5 ou ⌘R) para ver.');
})();
