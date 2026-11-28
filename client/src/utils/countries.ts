/**
 * Country calling codes for the phone field. Names come from the browser (Intl.DisplayNames), so there
 * is no list of names to keep in step. Codes are as dialled after "+"; Caribbean and other shared-"1"
 * territories carry their area code (Bahamas 1242) so a stored number finds its own country.
 */
const DIAL_CODES =
  "AF:93 AL:355 DZ:213 AS:1684 AD:376 AO:244 AI:1264 AG:1268 AR:54 AM:374 AW:297 AU:61 AT:43 AZ:994 BS:1242 BH:973 " +
  "BD:880 BB:1246 BY:375 BE:32 BZ:501 BJ:229 BM:1441 BT:975 BO:591 BA:387 BW:267 BR:55 VG:1284 BN:673 BG:359 BF:226 " +
  "BI:257 KH:855 CM:237 CA:1 CV:238 KY:1345 CF:236 TD:235 CL:56 CN:86 CO:57 KM:269 CG:242 CD:243 CK:682 CR:506 CI:225 " +
  "HR:385 CU:53 CW:599 CY:357 CZ:420 DK:45 DJ:253 DM:1767 DO:1809 EC:593 EG:20 SV:503 GQ:240 ER:291 EE:372 SZ:268 " +
  "ET:251 FK:500 FO:298 FJ:679 FI:358 FR:33 GF:594 PF:689 GA:241 GM:220 GE:995 DE:49 GH:233 GI:350 GR:30 GL:299 " +
  "GD:1473 GP:590 GU:1671 GT:502 GG:44 GN:224 GW:245 GY:592 HT:509 HN:504 HK:852 HU:36 IS:354 IN:91 ID:62 IR:98 " +
  "IQ:964 IE:353 IM:44 IL:972 IT:39 JM:1876 JP:81 JE:44 JO:962 KZ:7 KE:254 KI:686 XK:383 KW:965 KG:996 LA:856 " +
  "LV:371 LB:961 LS:266 LR:231 LY:218 LI:423 LT:370 LU:352 MO:853 MG:261 MW:265 MY:60 MV:960 ML:223 MT:356 MH:692 " +
  "MQ:596 MR:222 MU:230 YT:262 MX:52 FM:691 MD:373 MC:377 MN:976 ME:382 MS:1664 MA:212 MZ:258 MM:95 NA:264 NR:674 " +
  "NP:977 NL:31 NC:687 NZ:64 NI:505 NE:227 NG:234 NU:683 KP:850 MK:389 MP:1670 NO:47 OM:968 PK:92 PW:680 PS:970 " +
  "PA:507 PG:675 PY:595 PE:51 PH:63 PL:48 PT:351 PR:1787 QA:974 RE:262 RO:40 RU:7 RW:250 SH:290 KN:1869 LC:1758 " +
  "PM:508 VC:1784 WS:685 SM:378 ST:239 SA:966 SN:221 RS:381 SC:248 SL:232 SG:65 SX:1721 SK:421 SI:386 SB:677 " +
  "SO:252 ZA:27 KR:82 SS:211 ES:34 LK:94 SD:249 SR:597 SE:46 CH:41 SY:963 TW:886 TJ:992 TZ:255 TH:66 TL:670 TG:228 " +
  "TK:690 TO:676 TT:1868 TN:216 TR:90 TM:993 TC:1649 TV:688 UG:256 UA:380 AE:971 GB:44 US:1 UY:598 UZ:998 VU:678 " +
  "VE:58 VN:84 VI:1340 WF:681 YE:967 ZM:260 ZW:263";

export interface Country {
  iso: string;
  name: string;
  /** Digits after "+", e.g. "234". */
  dial: string;
}

/** Where a code is shared, the first of these owns it when reading a stored number back. */
const PREFERRED = ["US", "GB", "RU", "RE"];

export const DEFAULT_COUNTRY = "NG";
const STORAGE_KEY = "tf-phone-country";

let all: Country[] | undefined;
let byIso: Map<string, Country> | undefined;
let byDial: Map<string, Country> | undefined;

function build(): void {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  all = DIAL_CODES.split(" ")
    .map((pair) => {
      const [iso, dial] = pair.split(":");
      return { iso, dial, name: names.of(iso) ?? iso };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  byIso = new Map(all.map((c) => [c.iso, c]));
  byDial = new Map();
  for (const iso of [...PREFERRED, ...all.map((c) => c.iso)]) {
    const country = byIso.get(iso);
    if (country && !byDial.has(country.dial)) byDial.set(country.dial, country);
  }
}

/** Every country, A to Z by name. */
export function countries(): Country[] {
  if (!all) build();
  return all as Country[];
}

export function findCountry(iso: string): Country {
  if (!byIso) build();
  return (byIso as Map<string, Country>).get(iso) ?? ((byIso as Map<string, Country>).get(DEFAULT_COUNTRY) as Country);
}

/**
 * Splits a stored number into its country and the rest. "+2348031234567" → Nigeria, "8031234567".
 * A number with no "+" (an older "0803…") has no country we can know: `iso` is null and the digits stay as typed.
 */
export function parsePhone(value: string): { iso: string | null; national: string } {
  const text = value.replace(/[\s().-]/g, "");
  if (!text.startsWith("+")) return { iso: null, national: text };
  if (!byDial) build();
  const digits = text.slice(1);
  for (let length = 4; length >= 1; length--) {
    const match = (byDial as Map<string, Country>).get(digits.slice(0, length));
    if (match) return { iso: match.iso, national: digits.slice(length) };
  }
  return { iso: null, national: digits };
}

/** "+" + country code + the number without its leading trunk 0 ("0803…" → "803…"). Empty when nothing is typed. */
export function buildPhone(dial: string, national: string): string {
  const digits = national.replace(/\D/g, "").replace(/^0/, "");
  return digits ? `+${dial}${digits}` : "";
}

/**
 * A number as someone wrote it ("0803…", "00234…", "234803…") in international form, taking `iso` as the country
 * when the number doesn't name one.
 */
export function toInternational(written: string, iso: string): string {
  const text = written.replace(/[\s().-]/g, "");
  if (!text || text.startsWith("+")) return text;
  if (text.startsWith("00")) return `+${text.slice(2)}`;
  const { dial } = findCountry(iso);
  // It already carries the code, only without the "+": too long to be a local number.
  if (text.startsWith(dial) && text.length > 10) return `+${text}`;
  return buildPhone(dial, text);
}

/** The country this person picked last time, so the next phone field starts there. */
export function rememberedCountry(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return findCountry(saved).iso;
  } catch {
    /* storage blocked: start from the default */
  }
  return DEFAULT_COUNTRY;
}

export function rememberCountry(iso: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, iso);
  } catch {
    /* private mode: it lasts for this visit only */
  }
}
