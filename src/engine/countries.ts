// Código do mapa embutido (ISO 3166-1 alpha-3) para alpha-2, que é o que o Intl.DisplayNames entende.
// Tabela gerada a partir do i18n-iso-countries para os 195 códigos de world-main.json.
// Kosovo não tem alpha-3 oficial: o mapa usa XKX e o CLDR usa XK.
const TABLE = [
  'AFG:AF,AGO:AO,ALB:AL,AND:AD,ARE:AE,ARG:AR,ARM:AM,ATA:AQ,ATG:AG,AUS:AU,AUT:AT,AZE:AZ,BDI:BI,',
  'BEL:BE,BEN:BJ,BFA:BF,BGD:BD,BGR:BG,BHR:BH,BHS:BS,BIH:BA,BLR:BY,BLZ:BZ,BOL:BO,BRA:BR,BRB:BB,',
  'BRN:BN,BTN:BT,BWA:BW,CAF:CF,CAN:CA,CHE:CH,CHL:CL,CHN:CN,CIV:CI,CMR:CM,COD:CD,COG:CG,COL:CO,',
  'COM:KM,CPV:CV,CRI:CR,CUB:CU,CYP:CY,CZE:CZ,DEU:DE,DJI:DJ,DMA:DM,DNK:DK,DOM:DO,DZA:DZ,ECU:EC,',
  'EGY:EG,ERI:ER,ESP:ES,EST:EE,ETH:ET,FIN:FI,FJI:FJ,FRA:FR,FSM:FM,GAB:GA,GBR:GB,GEO:GE,GHA:GH,',
  'GIN:GN,GMB:GM,GNB:GW,GNQ:GQ,GRC:GR,GRD:GD,GTM:GT,GUY:GY,HND:HN,HRV:HR,HTI:HT,HUN:HU,IDN:ID,',
  'IND:IN,IRL:IE,IRN:IR,IRQ:IQ,ISL:IS,ISR:IL,ITA:IT,JAM:JM,JOR:JO,JPN:JP,KAZ:KZ,KEN:KE,KGZ:KG,',
  'KHM:KH,KIR:KI,KNA:KN,KOR:KR,KWT:KW,LAO:LA,LBN:LB,LBR:LR,LBY:LY,LCA:LC,LIE:LI,LKA:LK,LTU:LT,',
  'LUX:LU,LVA:LV,MAR:MA,MCO:MC,MDA:MD,MDG:MG,MDV:MV,MEX:MX,MHL:MH,MKD:MK,MLI:ML,MLT:MT,MMR:MM,',
  'MNE:ME,MNG:MN,MOZ:MZ,MRT:MR,MUS:MU,MWI:MW,MYS:MY,NAM:NA,NER:NE,NGA:NG,NIC:NI,NLD:NL,NOR:NO,',
  'NPL:NP,NRU:NR,NZL:NZ,OMN:OM,PAK:PK,PAN:PA,PER:PE,PHL:PH,PLW:PW,PNG:PG,POL:PL,PRK:KP,PRT:PT,',
  'PRY:PY,PSE:PS,QAT:QA,ROU:RO,RUS:RU,RWA:RW,SAU:SA,SDN:SD,SEN:SN,SGP:SG,SLB:SB,SLE:SL,SLV:SV,',
  'SOM:SO,SRB:RS,SSD:SS,STP:ST,SUR:SR,SVK:SK,SVN:SI,SWE:SE,SWZ:SZ,SYC:SC,SYR:SY,TCD:TD,TGO:TG,',
  'THA:TH,TJK:TJ,TKM:TM,TLS:TL,TON:TO,TTO:TT,TUN:TN,TUR:TR,TUV:TV,TWN:TW,TZA:TZ,UGA:UG,UKR:UA,',
  'URY:UY,USA:US,UZB:UZ,VCT:VC,VEN:VE,VNM:VN,VUT:VU,WSM:WS,XKX:XK,YEM:YE,ZAF:ZA,ZMB:ZM,ZWE:ZW',
].join('')

const ALPHA3_TO_ALPHA2 = new Map(TABLE.split(',').filter(Boolean).map((pair) => pair.split(':') as [string, string]))

const formatters = new Map<string, Intl.DisplayNames | null>()

function formatterFor(locale: string) {
  if (formatters.has(locale)) return formatters.get(locale) ?? null
  let formatter: Intl.DisplayNames | null = null
  try {
    formatter = new Intl.DisplayNames([locale], { type: 'region' })
  } catch {
    formatter = null
  }
  formatters.set(locale, formatter)
  return formatter
}

/** Nome do país no idioma pedido. Sem suporte do navegador ou sem correspondência, devolve o próprio código. */
export function countryName(code: string, locale: string): string {
  const alpha2 = ALPHA3_TO_ALPHA2.get(code)
  if (!alpha2) return code
  try {
    return formatterFor(locale)?.of(alpha2) ?? code
  } catch {
    return code
  }
}
