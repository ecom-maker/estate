/**
 * Tidy a nearby-place name coming from the Places feed.
 *
 * Google Places often returns an individual practitioner's listing instead of
 * the facility, e.g. "Dr Haitham Elsayed paediatric specialist ALZAHRA HOSPITAL
 * DUBAI". We want the facility ("Alzahra Hospital Dubai"), not the doctor.
 *
 * Conservative by design: the practitioner prefix is stripped only when BOTH a
 * title ("Dr"/"Prof"…) AND a clinical role word ("specialist"/"consultant"…)
 * are present before a facility keyword. That distinguishes a doctor-at-a-
 * facility listing from a facility *named* after a person (e.g. "Dr Sulaiman Al
 * Habib Hospital"), which is left untouched.
 */

const FACILITY =
  /\b(hospital|clinic|polyclinic|poly ?clinic|medical cent(?:er|re)|medical complex|health ?care|day surgery|diagnostic cent(?:er|re)|dental cent(?:er|re)|maternity|pharmacy|medical centre|college|school|academy|nursery|kindergarten|institute|university)\b/i;

const PRACTITIONER_PREFIX = /^(?:dr|prof|professor|doctor|mr|mrs|ms)\.?\s/i;

// Greedy up to the LAST role word, so the whole "Dr … <role>" lead is removed.
const PRACTITIONER_LEAD =
  /^(?:dr|prof|professor|doctor|mr|mrs|ms)\.?\b.*\b(?:specialist|consultant|physician|surgeon|dentist|gp|general practitioner|paediatric|pediatric|orthopaedic|orthopedic|dermatologist|gynaecologist|gynecologist|cardiologist|radiologist|ent|urologist|neurologist|psychiatrist|pediatrician|paediatrician)\b\s*/i;

const ACRONYMS = new Set(["DHA", "NMC", "JCI", "GEMS", "KHDA", "RAK", "UAE"]);

function titleCaseIfAllCaps(name: string): string {
  // Only reformat shouty ALL-CAPS names; leave correctly-cased names alone.
  if (!/[A-Z]/.test(name) || name !== name.toUpperCase()) return name;
  return name
    .split(/\s+/)
    .map((w) => {
      const bare = w.replace(/[^A-Za-z]/g, "");
      if (ACRONYMS.has(bare)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function cleanPlaceName(raw: string | null | undefined): string {
  let name = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) return name;

  if (PRACTITIONER_PREFIX.test(name) && FACILITY.test(name)) {
    const stripped = name.replace(PRACTITIONER_LEAD, "").trim();
    // Only accept the strip if a real facility name remains.
    if (stripped && stripped !== name && FACILITY.test(stripped)) {
      name = stripped;
    }
  }

  return titleCaseIfAllCaps(name).trim();
}
