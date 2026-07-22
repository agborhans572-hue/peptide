export const infoCards = [
  '5-Amino-1MQ',
  'Acetic Acid',
  'Adipotide',
  'AICAR',
  'AOD9604',
  'ARA-290',
  'BPC-157',
  'BPC-157/TB-500',
  'Cardiogen',
  'Cartalax',
  'Chonluten',
  'CJC-1295 (NO DAC)',
  'CJC-1295 (NO DAC) /Ipamorelin',
  'CJC-1295 (WITH DAC)',
  'CJC-1295 (WITH DAC)/Ipamorelin',
  'Cortagen',
  'DSIP',
  'Epithalon',
  'Follistatin 315',
  'Follistatin 344',
  'FOXO4-DRI',
  'GDF-8',
  'GHK-Cu',
  'GHPR-2',
].map((title, index) => ({
  title,
  image: `/assets/peptide-info/card-${String(index + 1).padStart(2, '0')}.jpg`,
  guide: `/assets/peptide-info/guide-${String(index + 1).padStart(2, '0')}.pdf`,
}))

export const verificationSteps = [
  {
    title: 'Supplier Qualification',
    copy: 'Products are sourced exclusively from approved manufacturing partners selected according to predefined qualification standards, including manufacturing practices, consistency, and operational reliability.',
  },
  {
    title: 'Batch Identification',
    copy: 'Each product and weight combination receives a unique Batch ID, creating a complete traceability record linking the batch to its supplier, production details, and testing history.',
  },
  {
    title: 'Independent Testing',
    copy: 'Upon arrival, every batch undergoes physical inspection and three randomly selected vials are submitted to Ethos Analytics, our exclusive ISO/IEC 17025 accredited testing partner (Accreditation #: 117798 / License #: 000026LRCND60176649).',
  },
  {
    title: 'Qualification Review',
    copy: 'Only batches that successfully meet all applicable testing criteria are approved for release and issued a Certificate of Analysis (COA).',
  },
  {
    title: 'Dual-Publication Verification',
    copy: 'Approved COAs are published both by Ethos Analytics and within the Pure Health COA Library. This independent dual-publication model creates a transparent verification trail and helps safeguard the integrity of published analytical records.',
  },
  {
    title: 'Public COA Access',
    copy: 'Lot-specific COAs remain publicly accessible through our online COA Library for the active life of the product, allowing researchers to independently review testing records before and after purchase.',
  },
]

export const coaReadingSteps = [
  {
    title: 'Compound and CAS number',
    copy: 'The compound name should match the product you ordered. The CAS number is a unique chemical identifier registered in the Chemical Abstracts Service database — the same CAS number is used by every supplier and lab worldwide for a given compound.',
  },
  {
    title: 'Batch / Lot Number',
    copy: 'The unique identifier for the specific production run that yielded the material in your vial. The same identifier is printed vertically along the side of your product label.',
  },
  {
    title: 'Sample received and analysis conducted dates',
    copy: 'When the lab received the sample and when the analysis was performed.',
  },
  {
    title: 'Analytical method',
    copy: 'The techniques used — UHPLC-MS for identity and purity, LAL or rFC assay for endotoxin per USP <85>, petrifilm/qPCR for microbial limits per USP <61>/<62>.',
  },
  {
    title: 'Identity test',
    copy: 'Specification and result. The result should read “Conforms.”',
  },
  {
    title: 'Quantity',
    copy: 'Specification and measured result. Slight overages (e.g., 10.6 mg measured against a 10 mg label) are normal and expected.',
  },
  {
    title: 'Purity',
    copy: 'Specification (e.g., ≥99%) and measured result (e.g., 99.82%). The measured purity typically exceeds the specification — the specification is the floor, not the target.',
  },
  {
    title: 'Endotoxin',
    copy: 'Specification (typically expressed as an upper limit in EU/mg) and measured result. The result should fall below the specification limit.',
  },
  {
    title: 'Microbial limits',
    copy: 'Specifications for total aerobic count, total combined yeasts and molds, and absence of specified pathogens (typically per USP <61>/<62>).',
  },
  {
    title: 'Chromatogram (when present)',
    copy: 'Visual output from the HPLC or UHPLC analysis. Under ISO 17025 accreditation, the institutional documentation framework guarantees the rigor of every test; the chromatogram is supporting analytical evidence rather than the primary proof. Ethos Analytics COAs report results in summary form, with the full chromatographic data retained as part of the lab’s documented record.',
  },
]

export const coaRedFlags = [
  {
    title: 'No accreditation status disclosed for the issuing laboratory',
    copy: 'This is the single most important red flag. A COA from a non-accredited lab is a self-issued document with no independent oversight of the methodology behind it.',
  },
  {
    title: 'Missing or vague description of the analytical method',
    copy: 'A reliable COA names the specific technique used (e.g., UHPLC-MS, HPLC-UV, LAL assay) and describes the conditions of analysis.',
  },
  {
    title: 'No identity confirmation',
    copy: 'Some COAs report only purity percentage, with no separate test confirming that the compound being measured is actually the labeled compound. Purity is meaningless if identity is unverified.',
  },
  {
    title: 'Discrepancies in reported purity across labs or batches without explanation',
    copy: 'Some variation between batches is normal; substantial unexplained variation suggests inconsistent methodology.',
  },
  {
    title: 'Unsigned or undated certificates',
    copy: 'A COA should clearly identify the issuing lab, the analyst or certifying authority, and the date of analysis.',
  },
  {
    title: 'Inconsistent batch identifiers',
    copy: 'The batch number on the COA should match the batch number on the product label.',
  },
  {
    title: 'No supply-chain testing on a lyophilized vialed product',
    copy: 'For chemically synthesized lyophilized peptides, the standard appropriate panel includes endotoxin and microbial limits alongside identity, purity, and quantity. A COA that reports only the first three for a lyophilized vialed product is missing the supply-chain defense layer.',
  },
]

export const manufacturingIntro = [
  'There are two ways peptides are produced: chemical synthesis or biological production. Chemical synthesis builds the peptide one amino acid at a time from defined starting materials. Biological production uses living organisms — typically bacteria or yeast — engineered to express the peptide.',
  'All of our peptides are produced by independent third-party laboratories using solid-phase peptide synthesis. Nearly all SPPS facilities are based outside the US — that’s the global reality of how this raw material is made.',
  'Those raw materials are then lyophilized into the powder form you receive in the vial. This last step happens in so called ‘finishing’ labs around the world, including in the US — and over the last 5–6 months, that’s where Pure Health Peptides has moved to.',
  'That’s where (y)our product comes from. That’s why we test it the way we do — so you can be sure that what you receive is fully verified.',
]

export const manufacturingTesting = [
  'A pattern is emerging in the research peptide market: suppliers competing on the number of tests on a COA rather than whether those tests are the right ones for the material being analyzed. The relevant question isn’t how many tests appear — it’s whether they actually verify quality for the manufacturing method and supply chain that produced the product.',
  'For chemically synthesized peptides, three tests address the peptide itself: identity (mass spectrometry), purity (HPLC/UHPLC), and quantity. These confirm the synthesis produced the correct compound, at the correct purity, in the correct amount.',
  'Two further tests address the supply chain rather than the chemistry. Even when production involves no bacteria, handling, lyophilization, vial filling, storage, and transit are real contamination routes. Endotoxin testing (USP <85>) and microbial limits testing (USP <61>/<62>) confirm those downstream routes stayed clean.',
  'Other tests have narrow applicability here. Heavy metals and residual solvents are addressed at the source — through reagent quality control and validated lyophilization — rather than batch-level testing.',
  'Our standard panel reports the five measurements that are genuinely diagnostic for chemically synthesized lyophilized peptides in our supply chain: identity, purity, quantity, endotoxin, and microbial limits. We don’t pad the panel with tests of narrow applicability for our method — that’s analytical theater, not analytical rigor.',
]
