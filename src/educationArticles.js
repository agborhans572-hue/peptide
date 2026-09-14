import { articleAuthorityBySlug } from './educationAuthority.js'

const references = {
  q7a: {
    title: 'Q7A Good Manufacturing Practice Guidance for Active Pharmaceutical Ingredients',
    publisher: 'U.S. Food and Drug Administration',
    url: 'https://www.fda.gov/regulatory-information/search-fda-guidance-documents/q7a-good-manufacturing-practice-guidance-active-pharmaceutical-ingredients',
    note: 'See sections 11.2–11.5 for batch testing, Certificates of Analysis, and stability monitoring.',
  },
  q2: {
    title: 'Q2(R2) Validation of Analytical Procedures',
    publisher: 'U.S. Food and Drug Administration / ICH',
    url: 'https://www.fda.gov/regulatory-information/search-fda-guidance-documents/q2r2-validation-analytical-procedures',
    note: 'Framework for specificity, range, accuracy, precision, and robustness of analytical procedures.',
  },
  q6a: {
    title: 'Q6A Specifications: Test Procedures and Acceptance Criteria',
    publisher: 'U.S. Food and Drug Administration / ICH',
    url: 'https://www.fda.gov/regulatory-information/search-fda-guidance-documents/q6a-specifications-test-procedures-and-acceptance-criteria-new-drug-substances-and-new-drug-products',
    note: 'Explains the distinct roles of specifications, identity tests, assays, and impurity tests.',
  },
  cfr210: {
    title: '21 CFR § 210.3 — Definitions',
    publisher: 'Electronic Code of Federal Regulations',
    url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-C/part-210/section-210.3',
    note: 'Defines batch, lot, and lot or control number in a regulated manufacturing context.',
  },
  cfr211: {
    title: '21 CFR § 211.194 — Laboratory Records',
    publisher: 'Electronic Code of Federal Regulations',
    url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-C/part-211/section-211.194',
    note: 'Describes source, lot, method, raw-data, calculation, result, and review records for laboratory testing.',
  },
  nistMs: {
    title: 'Mass Spectrometry Instrument Lab',
    publisher: 'National Institute of Standards and Technology',
    url: 'https://www.nist.gov/mml/csd/biochemical-and-exposure-science-group/mass-spectrometry-instrument-lab',
    note: 'Overview of mass-to-charge measurement and liquid chromatography–mass spectrometry capabilities.',
  },
  ncbiMs: {
    title: 'Mass Spectrometry Can Be Used to Sequence Peptide Fragments and Identify Proteins',
    publisher: 'NCBI Bookshelf, Molecular Biology of the Cell',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK26936/',
    note: 'Explains intact-mass measurement, fragmentation, and peptide sequence inference.',
  },
  stability: {
    title: 'Recommendations for the generation, quantification, storage and handling of peptides used for mass spectrometry-based assays',
    publisher: 'Clinical Proteomics (via PubMed Central)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4830481/',
    note: 'Peer-reviewed consensus recommendations for research peptide calibrators and handling controls.',
  },
  physicalStability: {
    title: 'Factors affecting the physical stability (aggregation) of peptide therapeutics',
    publisher: 'Interface Focus (via PubMed Central)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5665799/',
    note: 'Review of concentration, oxidation, temperature, agitation, surfaces, and freeze-drying effects.',
  },
  fdaLyophilization: {
    title: 'Compliance Program 7346.832M: Pre-Approval Inspections of Biological Drug Products',
    publisher: 'U.S. Food and Drug Administration',
    url: 'https://www.fda.gov/media/191983/download',
    note: 'Attachment D describes process controls considered during lyophilization or freeze-drying inspections.',
  },
  peptideMass: {
    title: 'PeptideMass documentation',
    publisher: 'SIB Swiss Institute of Bioinformatics, ExPASy',
    url: 'https://web.expasy.org/peptide_mass/peptide-mass-doc.html',
    note: 'Reference documentation for calculating peptide masses from sequence and defined modifications.',
  },
}

const baseEducationArticles = [
  {
    slug: 'how-to-read-a-peptide-certificate-of-analysis',
    title: 'How to Read a Peptide Certificate of Analysis',
    shortTitle: 'How to Read a Peptide COA',
    category: 'Batch documentation',
    description: 'A field-by-field guide to peptide COAs: lot matching, methods, specifications, results, approvals, and the limits of what a certificate proves.',
    readingMinutes: 8,
    status: 'published',
    publishedAt: '2026-09-14',
    updatedAt: '2026-09-14',
    quickAnswer: 'A useful COA connects one identified material and lot to named test methods, acceptance criteria, actual results, and an accountable laboratory or quality reviewer. Read the document as a traceability record—not as a single purity number.',
    takeaways: [
      'Match the product name and lot number on the container to the COA before interpreting any result.',
      'Keep identity, chromatographic purity, assay or content, and quantity as separate questions.',
      'Look for methods, units, specifications, actual results, dates, and an accountable issuing party.',
      'A COA does not automatically establish sterility, endotoxin status, stability, or suitability for a particular experiment unless those attributes were specifically tested.',
    ],
    sections: [
      {
        heading: 'Start with the document-to-vial match',
        paragraphs: [
          'The first task is not interpreting a chromatogram. It is confirming that the certificate belongs to the material in front of you. Compare the exact product or material name, presentation, and lot or batch number. A catalog SKU identifies a product listing; a lot number identifies a specific production grouping. They are not interchangeable.',
          'Record the report identifier, test laboratory, sample receipt or test date, and release or approval date when shown. If a certificate is revised, the revision number or superseded-document trail should make that change visible. A polished PDF with no batch connection is weak evidence.',
        ],
      },
      {
        heading: 'Read specifications and results as different fields',
        paragraphs: [
          'A specification is the pre-established acceptance limit or criterion. A result is what the laboratory measured for that sample. “Purity ≥98%” is a specification; “99.1% by RP-HPLC” is a result. A pass or conforming statement should be traceable to both fields, not presented in place of the numerical result when the test produces a number.',
          'Check the unit and the basis of measurement. Percent peak area, percent by mass, milligrams per vial, water content, and concentration describe different attributes. They should never be treated as synonyms.',
        ],
      },
      {
        heading: 'Separate the major analytical questions',
        paragraphs: [
          'Identity asks whether the detected material is consistent with the intended analyte. Mass spectrometry commonly supports this by comparing an observed ion or deconvoluted mass with an expected mass. Chromatographic purity asks how much of the detected chromatographic signal is assigned to the main peak under one stated method. Assay or content asks how much analyte is present. Quantity testing asks how much material is in the container.',
          'One result cannot quietly stand in for another. A high HPLC area percentage does not establish vial fill mass, and an expected mass peak does not quantify every impurity. Orthogonal methods are valuable because they answer different questions.',
        ],
      },
      {
        heading: 'Check the method context',
        paragraphs: [
          'At minimum, the certificate should name the technique used for each reported attribute. More useful packages identify the method or procedure number, detector, reference material, and any relevant sample preparation or acceptance rule. Supporting chromatograms or spectra should carry the same sample or lot identifier as the certificate.',
          'Method suitability matters. ICH Q2(R2) treats specificity or selectivity, range, accuracy, precision, and robustness as performance characteristics chosen according to the procedure’s purpose. A result without enough method context cannot be independently interpreted simply because it has several decimal places.',
        ],
      },
      {
        heading: 'Recognize what is not established',
        paragraphs: [
          'A COA reports the tests that were performed; it is not a universal quality guarantee. If the certificate does not report microbial limits, endotoxin, residual solvents, water, counterion, or stability, do not infer those results. “Third-party tested” also needs context: identify who tested what, on which lot, using which method, and when.',
          'The FDA and ICH documents cited below apply to regulated drug manufacturing, not automatically to research-material sellers. We use them here as a transparent benchmark for the kinds of fields that make analytical records interpretable. Their inclusion does not claim that a research product is an approved drug or was manufactured under a particular regulatory status.',
        ],
      },
      {
        heading: 'A practical 60-second COA check',
        bullets: [
          'Match material name, format, and lot number.',
          'Identify the issuing laboratory and report number.',
          'Confirm test and approval dates and any revision status.',
          'For every claim, find the method, specification, result, and unit.',
          'Confirm supporting traces carry the same sample identifier.',
          'Note attributes that were not tested instead of assuming they passed.',
          'Save the certificate with the receiving and inventory record for that lot.',
        ],
      },
    ],
    sources: [references.q7a, references.q2, references.q6a, references.cfr211],
    related: ['understanding-hplc-purity-testing', 'what-mass-spectrometry-confirms-in-peptide-testing', 'how-batch-level-coa-verification-works'],
    internalLinks: [
      { path: '/coa-library/', label: 'Search the batch COA library' },
      { path: '/coa-process/', label: 'Review our COA testing process' },
    ],
  },
  {
    slug: 'understanding-hplc-purity-testing',
    title: 'Understanding HPLC Purity Testing',
    shortTitle: 'Understanding HPLC Purity',
    category: 'Analytical methods',
    description: 'Learn what an HPLC chromatogram and area-percent result show, which method details matter, and what peptide purity does not prove by itself.',
    readingMinutes: 9,
    status: 'published',
    publishedAt: '2026-09-14',
    updatedAt: '2026-09-14',
    quickAnswer: 'HPLC separates detectable sample components under a defined method. A reported area-percent purity usually describes the main peak’s share of integrated detector response—not percent peptide by total vial mass and not complete proof of identity.',
    takeaways: [
      'HPLC purity is method-dependent: column, mobile phase, gradient, temperature, detector, and integration rules affect the result.',
      'Retention time helps compare peaks under matched conditions, but a single retention time alone is not a specific identity test.',
      'Area percent is a detector-response ratio; it is not automatically mass percent or content per vial.',
      'Pair chromatographic separation with an identity method and separate quantity or assay testing when those attributes matter.',
    ],
    sections: [
      {
        heading: 'What happens during an HPLC run',
        paragraphs: [
          'High-performance liquid chromatography moves a liquid sample through a column containing a stationary phase. Components interact differently with the mobile and stationary phases, so they leave the column at different times. A detector records the response and software displays a chromatogram.',
          'The horizontal axis is typically time. The vertical axis is detector response. A peak’s retention time describes when it was detected under those conditions; its integrated area describes the accumulated detector response assigned to that peak. Neither value is meaningful without the method and sample context.',
        ],
      },
      {
        heading: 'What “99% purity” commonly means',
        paragraphs: [
          'For a relative-area calculation, the software integrates selected peaks and reports the main peak as a percentage of the total integrated area. A 99% result therefore means that the main peak accounted for about 99% of the included detector response under that run and integration method.',
          'That wording matters. Compounds may respond differently at the selected wavelength, some components may not be detected, and excluded solvent fronts or system peaks may not enter the calculation. The result does not mean that 99% of everything inside a vial is peptide by mass. Salts, counterions, water, and substances without comparable detector response require other measurements.',
        ],
      },
      {
        heading: 'Method details that change interpretation',
        bullets: [
          'Column chemistry and dimensions, which determine the separation environment.',
          'Mobile phases, additives, gradient program, flow rate, and column temperature.',
          'Detector type and wavelength; peptide-bond detection is often performed in the low-UV range, while aromatic residues can support other wavelengths.',
          'Sample concentration, diluent, injection volume, and reference preparation.',
          'System-suitability criteria such as resolution, repeatability, or signal-to-noise.',
          'Peak-integration rules, including which peaks are included, excluded, or manually adjusted.',
        ],
        paragraphs: [
          'Comparing purity numbers from two laboratories is unreliable when these conditions differ. A scientifically useful comparison starts with whether the methods were designed and validated for the same analytical purpose.',
        ],
      },
      {
        heading: 'Retention time is evidence, not complete identity proof',
        paragraphs: [
          'A main peak appearing near a reference standard can support identification, but unrelated compounds can co-elute or share a similar retention time. FDA’s Q6A guidance specifically notes that identification solely by one chromatographic retention time is not regarded as specific. Coupling chromatography with mass spectrometry or using another orthogonal identity procedure adds discriminating evidence.',
          'Likewise, one tall main peak can conceal co-eluting material. Resolution between critical peaks and demonstrated selectivity are more informative than visual neatness alone.',
        ],
      },
      {
        heading: 'How to review a chromatogram',
        bullets: [
          'Match the sample name, lot, report number, and run identifier to the COA.',
          'Find the stated method, detector, wavelength, and test date.',
          'Check whether the main peak is identified and whether all relevant peaks are integrated.',
          'Look for a peak table with retention times and areas rather than relying on the plot alone.',
          'Confirm the reported calculation and acceptance criterion.',
          'Ask whether system suitability passed and whether the method can separate expected impurities or degradants.',
        ],
      },
      {
        heading: 'The correct conclusion',
        paragraphs: [
          'A defensible statement is narrow: “This sample produced the reported chromatographic purity under the identified HPLC method.” Broader conclusions about identity, content, sterility, stability, or experimental suitability need their own evidence. This disciplined wording is not a weakness; it is what makes the result useful.',
        ],
      },
    ],
    sources: [references.q2, references.q6a, references.q7a],
    related: ['how-to-read-a-peptide-certificate-of-analysis', 'what-mass-spectrometry-confirms-in-peptide-testing', 'understanding-peptide-sequence-and-molecular-weight'],
    internalLinks: [
      { path: '/coa-process/', label: 'See how HPLC and identity testing fit together' },
      { path: '/coa-library/', label: 'Browse batch-specific test reports' },
    ],
  },
  {
    slug: 'what-mass-spectrometry-confirms-in-peptide-testing',
    title: 'What Mass Spectrometry Confirms in Peptide Testing',
    shortTitle: 'What Mass Spectrometry Confirms',
    category: 'Analytical methods',
    description: 'Understand mass-to-charge data, intact mass, charge states, adducts, tandem MS, and the limits of mass spectrometry for peptide identity testing.',
    readingMinutes: 9,
    status: 'scheduled',
    publishedAt: '2026-09-21',
    updatedAt: '2026-09-21',
    quickAnswer: 'Mass spectrometry tests whether measured ions are consistent with an expected molecular mass. Intact-mass agreement is strong identity evidence, while tandem MS can add sequence information. Neither result alone establishes chromatographic purity, vial quantity, or sterility.',
    takeaways: [
      'A mass spectrometer measures mass-to-charge ratio (m/z), not molecular weight directly.',
      'Charge state, isotope selection, adducts, counterions, and terminal modifications must be considered before comparing observed and theoretical values.',
      'Intact mass supports molecular identity; MS/MS fragmentation can provide sequence-specific evidence.',
      'Mass spectrometry and HPLC are complementary rather than interchangeable.',
    ],
    sections: [
      {
        heading: 'From a peptide molecule to an m/z spectrum',
        paragraphs: [
          'Mass spectrometry first converts analyte molecules into gas-phase ions. The instrument separates or detects those ions according to mass-to-charge ratio, written m/z. Because peptides can carry more than one charge, the same molecule may appear as a family of peaks at different m/z values.',
          'Software can use charge-state and isotope patterns to calculate a neutral or deconvoluted mass. A report should make clear whether it lists a raw ion, such as [M+2H]2+, or a calculated neutral mass. Comparing an m/z value directly with an uncharged theoretical molecular mass is a common reading error.',
        ],
      },
      {
        heading: 'Expected mass depends on the exact molecular definition',
        paragraphs: [
          'The theoretical value must represent the material actually specified. N-terminal acetylation, C-terminal amidation, oxidation, disulfide bonds, isotopic labels, and other modifications change mass. So can the convention used: monoisotopic mass and average molecular mass are different quantities.',
          'Adducts formed during ionization can shift observed peaks by recognizable amounts. Sodium or potassium adducts, protonation, and multiply charged ions should be annotated rather than mistaken for unrelated material. Counterions and bound water may affect bulk composition even when they are not part of the peptide’s covalent sequence mass.',
        ],
      },
      {
        heading: 'Intact mass versus tandem mass spectrometry',
        paragraphs: [
          'An intact-mass experiment asks whether the whole analyte has the expected mass within the method’s tolerance. Agreement can rule out many incorrect candidates, but different sequences can share the same nominal or even exact composition. Isomeric residues such as leucine and isoleucine also have the same residue mass.',
          'Tandem mass spectrometry (MS/MS) selects an ion, fragments it, and measures the product ions. The resulting series can support portions of the amino-acid order and localize some modifications. Sequence coverage, fragment quality, mass accuracy, and the search or interpretation method determine how strong that conclusion is.',
        ],
      },
      {
        heading: 'What to look for on a mass report',
        bullets: [
          'The sample and lot identifier and the date of analysis.',
          'The ionization and analyzer or method description, such as LC-MS, ESI-MS, or MALDI-TOF.',
          'The expected mass, observed value, mass convention, and stated tolerance or error.',
          'Annotations for charge states, isotope peaks, adducts, fragments, and modifications.',
          'A conclusion tied to acceptance criteria, with an accountable laboratory or reviewer.',
          'If sequence confirmation is claimed, the MS/MS evidence and reported sequence coverage.',
        ],
      },
      {
        heading: 'What mass spectrometry does not prove by itself',
        paragraphs: [
          'A correct target-mass peak does not quantify all other components in a sample. Ionization efficiencies differ, low-level species may fall below the reporting threshold, and an untargeted contaminant may not be interpreted. Mass data also do not state how many milligrams are in the vial unless the method was designed and validated for quantitative assay.',
          'For that reason, a coherent peptide test package often pairs mass-based identity evidence with a chromatographic purity method and, when required, a separate assay or quantity measurement. Microbial, endotoxin, water, residual-solvent, and stability attributes remain separate questions.',
        ],
      },
    ],
    sources: [references.nistMs, references.ncbiMs, references.q2, references.q6a],
    related: ['understanding-hplc-purity-testing', 'understanding-peptide-sequence-and-molecular-weight', 'how-to-read-a-peptide-certificate-of-analysis'],
    internalLinks: [
      { path: '/coa-process/', label: 'Review the complete analytical testing process' },
      { path: '/coa-library/', label: 'Find batch-specific analytical reports' },
    ],
  },
  {
    slug: 'lyophilized-vs-liquid-research-materials',
    title: 'Lyophilized vs Liquid Research Materials',
    shortTitle: 'Lyophilized vs Liquid Materials',
    category: 'Material formats',
    description: 'Compare lyophilized and liquid research materials, including stability variables, formulation records, handling risks, and documentation to review.',
    readingMinutes: 8,
    status: 'scheduled',
    publishedAt: '2026-09-21',
    updatedAt: '2026-09-21',
    quickAnswer: 'Lyophilized material has had water removed through a controlled freeze-drying process; liquid material is already in a solvent system. The format changes stability and handling considerations, but neither format alone proves purity, sterility, or experimental suitability.',
    takeaways: [
      'Lyophilization can improve stability for some peptides, but performance remains sequence- and formulation-dependent.',
      'A liquid avoids a dissolution step but exposes the peptide continuously to its solvent environment.',
      'The correct storage condition must come from lot- and formulation-specific documentation, not a universal peptide rule.',
      'Format, excipients, concentration basis, container closure, and stability evidence belong in the comparison.',
    ],
    sections: [
      {
        heading: 'What lyophilization changes',
        paragraphs: [
          'Lyophilization, or freeze-drying, freezes a formulated solution and removes water under reduced pressure, primarily by sublimation and then desorption. The objective is a dry material with controlled residual moisture and physical structure. It is a manufacturing process, not a synonym for “pure” or “sterile.”',
          'The visible cake or powder may include the peptide plus buffer salts, bulking agents, stabilizers, and counterions. Cake appearance can be a useful process observation, but appearance alone cannot establish chemical identity, content, or stability.',
        ],
      },
      {
        heading: 'Why a dry format can help—and where it can fail',
        paragraphs: [
          'Removing bulk water can slow hydrolysis and molecular mobility, which is why solid-state presentation is often selected for materials that are unstable in aqueous solution. However, freezing and drying introduce their own stresses. Formulation, freezing rate, primary and secondary drying conditions, residual moisture, and container closure all affect the outcome.',
          'Peer-reviewed reviews emphasize that peptide stability is difficult to generalize. Sequence, concentration, pH, oxidation sensitivity, aggregation propensity, agitation, surfaces, temperature, and moisture can interact. A dry format therefore needs product-specific stability support just as a liquid format does.',
        ],
      },
      {
        heading: 'What changes in a liquid format',
        paragraphs: [
          'A liquid material removes the variability of a user-performed dissolution step, but its concentration depends on the stated solvent system and assay basis. Once in solution, degradation pathways such as hydrolysis, oxidation, deamidation, adsorption, aggregation, or precipitation may become more relevant depending on the sequence and conditions.',
          'Review the solvent, buffer, pH, concentration, preservatives or stabilizers, container material, headspace, light protection, temperature range, and supported storage period. Do not transfer instructions from one peptide or formulation to another.',
        ],
      },
      {
        heading: 'A documentation-first comparison',
        bullets: [
          'Exact analyte identity, sequence, terminal modifications, and salt or counterion form.',
          'All stated formulation components and the basis of the labeled quantity or concentration.',
          'Lot-specific identity, purity, assay or content, and water testing when applicable.',
          'Container-closure system and any light or moisture protection.',
          'Supported shipping, storage, and in-use conditions, including evidence behind the assigned period.',
          'Instructions for equilibration, opening, dissolution, mixing, and aliquoting when supplied by the manufacturer.',
        ],
      },
      {
        heading: 'What the format cannot tell you',
        paragraphs: [
          'Neither “lyophilized” nor “liquid” answers whether a material is suitable for a specific assay. Format does not establish sterility, endotoxin limits, purity, identity, or content. Those conclusions require explicit specifications and test results.',
          'For laboratory research, treat the format as one controlled variable in a larger material record. Follow the product label, batch certificate, safety documentation, and your institution’s validated SOP. If those sources conflict, quarantine the material and resolve the discrepancy before use.',
        ],
      },
    ],
    sources: [references.fdaLyophilization, references.stability, references.physicalStability, references.q7a],
    related: ['laboratory-storage-and-handling-guide', 'how-to-read-a-peptide-certificate-of-analysis', 'why-product-lot-numbers-matter'],
    internalLinks: [
      { path: '/manufacturing/', label: 'Read our quality and manufacturing standards' },
      { path: '/coa-library/', label: 'Review lot-specific documentation' },
    ],
  },
  {
    slug: 'laboratory-storage-and-handling-guide',
    title: 'Laboratory Storage and Handling Guide',
    shortTitle: 'Laboratory Storage & Handling',
    category: 'Laboratory practice',
    description: 'A documentation-first framework for receiving, storing, handling, and tracking peptide research materials without relying on universal conditions.',
    readingMinutes: 10,
    status: 'scheduled',
    publishedAt: '2026-09-28',
    updatedAt: '2026-09-28',
    quickAnswer: 'Use the product label, lot-specific documentation, safety data, and a validated laboratory SOP as the controlling instructions. Maintain traceability, protect materials from avoidable temperature, moisture, light, and handling stress, and document every state change.',
    takeaways: [
      'There is no universal storage temperature or solvent rule for every peptide.',
      'Separate receipt, unopened storage, working-stock, and in-use conditions in the record.',
      'Minimize avoidable moisture exposure, light exposure, agitation, and repeated freeze–thaw events when the product-specific procedure calls for those controls.',
      'Quarantine material when labeling, temperature history, container integrity, or documentation is inconsistent.',
    ],
    sections: [
      {
        heading: 'The controlling-document hierarchy',
        paragraphs: [
          'Start with the manufacturer’s label and lot-specific certificate, then the safety data and your institution’s approved SOP. General internet guidance cannot account for sequence, formulation, salt form, concentration, container closure, or the stability study used for a specific material.',
          'If two controlling documents disagree, do not choose the more convenient condition. Record the discrepancy, isolate the material, and obtain a documented clarification. This prevents an undocumented assumption from becoming part of the experiment.',
        ],
      },
      {
        heading: 'Receiving and accessioning',
        bullets: [
          'Inspect the shipper and primary container for damage, leakage, broken seals, or unexpected appearance.',
          'Record arrival date and time, carrier condition, any temperature indicator, and the person receiving the shipment.',
          'Match product, quantity, and lot number to the packing record and COA.',
          'Assign an internal inventory identifier without obscuring the manufacturer’s lot number.',
          'Move the material to the documented storage condition promptly and record any deviation.',
        ],
        paragraphs: [
          'Photographs and contemporaneous notes are more useful than reconstructing a shipping event later. If the material arrived outside an indicated range, quarantine it until a stability-based disposition is made.',
        ],
      },
      {
        heading: 'Control the storage environment',
        paragraphs: [
          'Temperature is only one variable. Light, oxygen, moisture, repeated door opening, vibration, and container compatibility can influence stability. Use monitored equipment appropriate to the stated range, keep a response plan for excursions, and avoid placing critical materials in poorly characterized warm zones or frost-prone locations.',
          'For moisture-sensitive dry material, opening a cold container can create condensation. A product-specific SOP may require the sealed container to reach the prescribed handling temperature before opening. The exact procedure and time must come from validated instructions, not a generic rule.',
        ],
      },
      {
        heading: 'Plan working portions before opening',
        paragraphs: [
          'Repeated access increases the opportunities for moisture uptake, contamination, adsorption, oxidation, and temperature cycling. Where the formulation and SOP permit, plan working portions that reduce repeated handling of the primary stock. Use compatible, low-binding containers when specified and preserve the lot link on every secondary label.',
          'For solutions, freeze–thaw tolerance is peptide- and formulation-specific. Consensus recommendations for peptide calibrators advise limiting repeated freeze–thaw cycles, but that is not a substitute for stability data. Record preparation date, concentration basis, solvent, operator, parent lot, storage condition, and supported use period.',
        ],
      },
      {
        heading: 'Maintain an auditable chain of custody',
        bullets: [
          'Current location and storage unit identifier.',
          'Parent container, aliquot, and transfer relationships.',
          'Date, time, operator, and amount for each preparation or removal.',
          'Temperature excursions, visible changes, spills, or container damage.',
          'Instrument or experiment record in which each portion was used.',
          'Disposition, including exhaustion, return, quarantine, or disposal under the laboratory’s waste procedure.',
        ],
      },
      {
        heading: 'Avoid conclusions based on appearance alone',
        paragraphs: [
          'Clarity, color, or cake appearance can reveal an obvious change, but normal appearance does not confirm molecular integrity. Conversely, a cosmetic difference does not identify its cause. Investigate unexpected appearance against historical observations and analytical data rather than relabeling it as acceptable.',
          'This guide addresses controlled laboratory materials only. It does not provide instructions for human or veterinary administration. Research institutions should conduct their own risk assessment and follow applicable biosafety, chemical-hygiene, waste, and occupational-safety requirements.',
        ],
      },
    ],
    sources: [references.stability, references.physicalStability, references.q7a, references.cfr211],
    related: ['lyophilized-vs-liquid-research-materials', 'why-product-lot-numbers-matter', 'how-batch-level-coa-verification-works'],
    internalLinks: [
      { path: '/manufacturing/', label: 'Review material handling and quality standards' },
      { path: '/contact-us/', label: 'Ask about product-specific documentation' },
    ],
  },
  {
    slug: 'how-batch-level-coa-verification-works',
    title: 'How Batch-Level COA Verification Works',
    shortTitle: 'Batch-Level COA Verification',
    category: 'Batch documentation',
    description: 'Follow the traceability chain from a product label and lot number to a batch-specific COA, analytical attachments, and release decision.',
    readingMinutes: 8,
    status: 'scheduled',
    publishedAt: '2026-09-28',
    updatedAt: '2026-09-28',
    quickAnswer: 'Batch-level verification succeeds when the lot on the physical container resolves to one controlled certificate and its supporting test records. The identity, purity, quantity, dates, methods, and disposition must all refer to that same batch.',
    takeaways: [
      'Product-level or representative reports are not substitutes for the lot actually received.',
      'The certificate, chromatogram, spectrum, and internal inventory record should share traceable identifiers.',
      'Independent testing is meaningful only when sample custody and the tested batch are clear.',
      'A revised or replaced report needs visible version control so an obsolete result is not mistaken for current documentation.',
    ],
    sections: [
      {
        heading: 'The traceability chain',
        paragraphs: [
          'Begin with the physical container. Its lot number is the join key between the received item, supplier records, analytical sample, certificate, and any later investigation. Search by that value rather than by product name alone, because multiple lots of the same catalog item can have different dates and test results.',
          'A useful digital library preserves that one-to-one relationship. The result page should identify the exact lot, expose the report rather than only a marketing badge, and keep historical certificates distinguishable. If a product is relabeled or repacked, the records should preserve both the distributed lot and the source-batch relationship.',
        ],
      },
      {
        heading: 'Confirm report authenticity and scope',
        bullets: [
          'Issuing laboratory or quality unit, with contact or accreditation information when applicable.',
          'Unique report number, version, page count, and approval or signature controls.',
          'Sample description and lot number matching the submitted and distributed material.',
          'Receipt, analysis, and report dates in a plausible sequence.',
          'Named tests, methods, specifications, numerical results, and units.',
          'Attachments whose sample IDs and page references connect back to the report.',
        ],
      },
      {
        heading: 'Independent testing requires sample accountability',
        paragraphs: [
          'A third-party laboratory can reduce conflicts of interest, but the phrase “third-party tested” is incomplete without a sample trail. The records should establish who submitted the sample, how it was identified, which batch it represented, and whether the result shown is the original laboratory report or a supplier-created summary.',
          'An independent result does not correct a broken lot link. If the report tested a pre-shipment bulk sample while the label identifies a later repacked lot, the relationship between those identifiers must be documented.',
        ],
      },
      {
        heading: 'Interpret the release decision',
        paragraphs: [
          'The report should compare actual results with established acceptance criteria. A passing result means the tested sample met those listed criteria under the named methods. It does not extend to untested attributes.',
          'If a result is out of specification, atypical, corrected, or repeated, the final certificate should not conceal that history. Controlled records should show the valid disposition and reference the investigation or superseded version as appropriate. Readers do not need confidential manufacturing details, but they do need to know which report is current.',
        ],
      },
      {
        heading: 'How to verify a lot in our library',
        bullets: [
          'Read the lot number directly from the container label.',
          'Open the COA Library and select the correct product format.',
          'Find the product and choose the matching lot—not merely the newest report.',
          'Compare the product, lot, test laboratory, report date, methods, and results.',
          'Save the report with your receiving record and contact support if any identifier conflicts.',
        ],
        paragraphs: [
          'Our library is a retrieval layer for batch documents. The laboratory report remains the analytical record. If the library metadata and the report disagree, pause and report the mismatch so it can be corrected.',
        ],
      },
    ],
    sources: [references.q7a, references.cfr210, references.cfr211, references.q2],
    related: ['how-to-read-a-peptide-certificate-of-analysis', 'why-product-lot-numbers-matter', 'understanding-hplc-purity-testing'],
    internalLinks: [
      { path: '/coa-library/', label: 'Verify a product lot in the COA library' },
      { path: '/contact-us/', label: 'Report a document or lot mismatch' },
    ],
  },
  {
    slug: 'why-product-lot-numbers-matter',
    title: 'Why Product Lot Numbers Matter',
    shortTitle: 'Why Lot Numbers Matter',
    category: 'Traceability',
    description: 'Learn how lot numbers connect physical research materials to manufacturing history, test results, inventory, investigations, and disposition.',
    readingMinutes: 7,
    status: 'scheduled',
    publishedAt: '2026-10-05',
    updatedAt: '2026-10-05',
    quickAnswer: 'A lot number is a traceability identifier for a defined production grouping. It connects the container in hand to batch records, analytical results, distribution history, and any later correction, investigation, or recall.',
    takeaways: [
      'A product name or SKU identifies what was ordered; a lot number identifies the production grouping supplied.',
      'Every aliquot, working solution, and experiment record should retain the parent lot link.',
      'Lot-specific COAs let researchers avoid applying one batch’s result to another batch.',
      'Clear lot records make targeted investigation and disposition possible when a problem appears.',
    ],
    sections: [
      {
        heading: 'Product identity is not batch identity',
        paragraphs: [
          'A catalog identifier may remain unchanged for years while raw materials, synthesis runs, purification runs, packaging dates, and test reports change. The lot number narrows that broad product identity to a specific controlled grouping.',
          'In 21 CFR § 210.3, a lot is defined in a regulated drug-manufacturing context as a batch or identified portion of a batch with uniform character and quality within specified limits. A lot number is the distinctive code from which its manufacturing, processing, packing, holding, and distribution history can be determined. Research materials do not automatically fall under that drug regulation, but the definition illustrates why the identifier is operationally important.',
        ],
      },
      {
        heading: 'Where the lot link should appear',
        bullets: [
          'Primary container label and any outer packaging.',
          'Packing list, receiving record, and internal inventory system.',
          'Certificate of Analysis and supporting chromatograms or spectra.',
          'Aliquot labels, working-stock records, and preparation worksheets.',
          'Instrument sequence, notebook, sample manifest, and final data package.',
          'Deviation, complaint, return, or disposal record when applicable.',
        ],
      },
      {
        heading: 'Why experiments need the parent lot',
        paragraphs: [
          'If an unexpected observation appears, the lot link lets a laboratory compare affected work, review the correct certificate, and determine whether other containers from the same grouping were involved. Without it, a result may be impossible to reproduce or investigate.',
          'When transferring material into a secondary container, preserve the original product name, lot number, preparation or transfer date, responsible person, and any new internal identifier. A barcode can make entry easier, but it should resolve to readable records rather than becoming the only copy of the information.',
        ],
      },
      {
        heading: 'Common traceability failures',
        bullets: [
          'Recording only a product name or catalog SKU in the notebook.',
          'Downloading the newest COA instead of the COA for the received lot.',
          'Combining material from different lots under one inventory identifier.',
          'Relabeling aliquots without the parent lot or preparation record.',
          'Overwriting a corrected certificate instead of preserving version history.',
          'Assuming two containers shipped together must belong to the same lot.',
        ],
      },
      {
        heading: 'A small field with large quality value',
        paragraphs: [
          'Lot numbers do not prove quality by themselves. Their value is that they connect quality evidence to the right physical material. A strong system makes that connection easy to follow in both directions: from container to report, and from a report or investigation back to every affected container and record.',
        ],
      },
    ],
    sources: [references.cfr210, references.cfr211, references.q7a],
    related: ['how-batch-level-coa-verification-works', 'how-to-read-a-peptide-certificate-of-analysis', 'laboratory-storage-and-handling-guide'],
    internalLinks: [
      { path: '/coa-library/', label: 'Look up a lot-specific certificate' },
      { path: '/coa-process/', label: 'Learn how analytical results connect to a batch' },
    ],
  },
  {
    slug: 'understanding-peptide-sequence-and-molecular-weight',
    title: 'Understanding Peptide Sequence and Molecular Weight',
    shortTitle: 'Peptide Sequence & Molecular Weight',
    category: 'Peptide fundamentals',
    description: 'Learn how amino-acid order, termini, modifications, mass conventions, charge states, counterions, and water affect peptide identity and reported mass.',
    readingMinutes: 9,
    status: 'scheduled',
    publishedAt: '2026-10-05',
    updatedAt: '2026-10-05',
    quickAnswer: 'A peptide sequence states the ordered amino-acid residues, conventionally from the N-terminus to the C-terminus. Its calculated mass depends on that exact sequence plus terminal chemistry, covalent modifications, and the chosen monoisotopic or average-mass convention.',
    takeaways: [
      'The same residues in a different order represent a different sequence even when the total elemental composition—and mass—can be the same.',
      'Terminal amidation, acetylation, disulfide formation, oxidation, labels, and conjugates change the expected mass.',
      'Average molecular mass, monoisotopic mass, neutral mass, and observed m/z are related but different values.',
      'Counterions, residual water, and excipients affect bulk material mass without necessarily changing the covalent peptide sequence.',
    ],
    sections: [
      {
        heading: 'Reading a peptide sequence',
        paragraphs: [
          'Peptide sequences are normally written from the amino or N-terminus on the left to the carboxyl or C-terminus on the right. One-letter codes make long sequences compact; three-letter codes can be easier to audit. The record should define any non-standard residue, linker, cyclization, isotope label, or other modification.',
          'Order is part of identity. Two peptides can contain the same count of each amino acid and therefore have the same unmodified elemental composition, yet differ in sequence and behavior. Intact molecular mass alone cannot distinguish every such isomeric or reordered candidate.',
        ],
      },
      {
        heading: 'How theoretical peptide mass is built',
        paragraphs: [
          'A peptide chain forms when amino acids join through peptide bonds, with the net loss of water for each bond formed. Calculation software typically sums residue masses and adds the terminal groups for the defined linear sequence. The calculation must then account for terminal caps and every specified covalent modification.',
          'Common examples include N-terminal acetylation, C-terminal amidation, oxidation, phosphorylation, lipidation, polyethylene glycol attachments, fluorescent labels, and disulfide bonds. A report that lists a sequence without its terminal or modification state leaves the expected mass ambiguous.',
        ],
      },
      {
        heading: 'Average mass and monoisotopic mass',
        paragraphs: [
          'Average molecular mass uses the abundance-weighted average atomic masses found in nature. Monoisotopic mass uses the exact masses of the most abundant stable isotopes for the molecule’s atoms. The values diverge as molecules become larger, so a certificate and a spectrum should identify which convention is being compared.',
          'Mass spectrometers measure m/z for ions. A peptide carrying two protons has a different m/z from the same peptide carrying three, even though the underlying neutral molecule is the same. Deconvolution uses the observed charge envelope to estimate the neutral mass.',
        ],
      },
      {
        heading: 'Peptide mass is not the same as vial composition',
        paragraphs: [
          'The sequence mass describes the covalent peptide entity. A vial may also contain counterions, salts, water, buffer components, or other excipients. Those materials contribute to the total physical mass but are not represented by the amino-acid sequence alone.',
          'This is why HPLC purity, mass-spectrometric identity, peptide content or assay, water content, and net vial quantity answer separate questions. A theoretical molecular weight cannot be used to infer how many milligrams of peptide are present without an appropriate quantitative measurement and clearly defined basis.',
        ],
      },
      {
        heading: 'A sequence-and-mass review checklist',
        bullets: [
          'Confirm that the sequence direction and residue notation are defined.',
          'Identify N- and C-terminal chemistry.',
          'List every modification, bridge, conjugate, or non-standard residue.',
          'State salt or counterion form separately from the covalent sequence.',
          'Identify whether the theoretical value is monoisotopic or average mass.',
          'For MS data, identify ion, charge state, adduct, observed m/z, deconvoluted mass, and tolerance.',
          'Use orthogonal evidence when sequence order or modification location must be distinguished.',
        ],
      },
    ],
    sources: [references.peptideMass, references.nistMs, references.ncbiMs, references.q6a],
    related: ['what-mass-spectrometry-confirms-in-peptide-testing', 'understanding-hplc-purity-testing', 'how-to-read-a-peptide-certificate-of-analysis'],
    internalLinks: [
      { path: '/info-cards/', label: 'Browse peptide identity and molecular reference cards' },
      { path: '/coa-process/', label: 'See how identity and purity testing differ' },
    ],
  },
]

export const educationArticles = baseEducationArticles.map((article) => ({
  ...article,
  ...articleAuthorityBySlug[article.slug],
}))

export const educationArticleBySlug = Object.fromEntries(
  educationArticles.map((article) => [article.slug, article]),
)

export const publishedEducationArticles = educationArticles.filter((article) => article.status === 'published')
export const scheduledEducationArticles = educationArticles.filter((article) => article.status === 'scheduled')

export const educationArticlePath = (articleOrSlug) => {
  const slug = typeof articleOrSlug === 'string' ? articleOrSlug : articleOrSlug.slug
  return `/news/${slug}/`
}
