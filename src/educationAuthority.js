const blendCoa = {
  id: 'coa-12670',
  label: 'BioRegen COA #12670',
  href: 'https://purehealthpeptides.com/wp-content/uploads/2026/04/COA_539_BPC-157_TB-500_10_10mg-Lot-SYN-030926.pdf',
  sample: 'BPC-157 / TB-500 lyophilized blend, lot SYN-030926',
  laboratory: 'BioRegen',
  analyst: 'Dr. Roberto Marin, Analytical Chemist',
  dates: 'Sample received March 19, 2026; analysis conducted April 1, 2026',
  method: 'Qualitative and quantitative UHPLC with mass spectrometry',
  observations: [
    'BPC-157: identity conformed; 11.4 mg reported against a 10 mg specification; 99.61% purity reported against a >99% specification.',
    'TB-500: identity conformed; 13.1 mg reported against a 10 mg specification; 99.26% purity reported against a >99% specification.',
    'The report includes chromatograms, full-scan mass-spectrometry pages, calibration curves, the lot identifier, and the named analyst.',
  ],
  limitations: 'These values describe the submitted sample for lot SYN-030926. They are not a claim about a different lot, a stability study, sterility evidence, or authorization for human or veterinary use.',
  products: [
    { path: '/product/bpc-157-tb-500/', label: 'BPC-157 / TB-500 research blend' },
  ],
}

const liquidCoa = {
  id: 'ethos-26ea0122-029',
  label: 'Ethos Analytics report 26EA0122-029',
  href: 'https://purehealthpeptides.com/wp-content/uploads/2026/03/COA_02_BPC-157-Research-Spray-0.14ml_spray-Lot-26012002-GJ14.pdf',
  sample: 'BPC-157 research liquid, lot 26012002',
  laboratory: 'Ethos Analytics',
  analyst: 'Noel Samsum, Laboratory Director (named on the report)',
  dates: 'Sample received January 22, 2026; testing completed January 29, 2026',
  method: 'HPLC; identity stated as retention-time concordance with a certified reference standard under USP <621>',
  observations: [
    'The report records 156.38 mcg per spray against a 150 mcg per spray specification.',
    'It identifies the sample as a liquid and states that the result applies only to the specified sample.',
    'The report notes that formulation excipients may be non-chromophoric and may not be detected under the stated HPLC conditions.',
  ],
  limitations: 'This is a finished-liquid sample report, not a direct head-to-head study against the lyophilized blend above. Different matrices and analytical purposes should not be compared as if they were the same test.',
  products: [
    { path: '/product/bpc-157-liquid/', label: 'BPC-157 research liquid' },
  ],
}

const diagram = (title, caption, steps) => ({ title, caption, steps })
const evidence = (title, interpretation, records = [blendCoa]) => ({ title, interpretation, records })

export const articleAuthorityBySlug = {
  'how-to-read-a-peptide-certificate-of-analysis': {
    reviewer: null,
    diagram: diagram(
      'The COA traceability chain',
      'A result becomes useful only when every link points to the same material and lot.',
      [
        ['Container', 'Product name and presentation'],
        ['Lot', 'Exact batch identifier'],
        ['Report', 'Sample ID and test dates'],
        ['Evidence', 'Methods, specifications, and results'],
        ['Accountability', 'Issuing laboratory and approval'],
      ],
    ),
    sectionCitations: [[1, 4], [1, 3, 4], [2, 3], [2], [1, 3], [1, 4]],
    testingEvidence: evidence(
      'Read a real batch record with the guide',
      'COA #12670 demonstrates the fields discussed above: one lot, two analytes, a named method, separate specifications and results, supporting traces, and an identified analyst.',
    ),
  },
  'understanding-hplc-purity-testing': {
    reviewer: null,
    diagram: diagram(
      'From injection to an area-percent result',
      'This is an explanatory workflow, not a chromatogram or measured result.',
      [
        ['Inject', 'Prepared sample enters the system'],
        ['Separate', 'Components interact with the column'],
        ['Detect', 'A detector records signal over time'],
        ['Integrate', 'Software assigns peak boundaries and areas'],
        ['Interpret', 'The method defines what the ratio means'],
      ],
    ),
    sectionCitations: [[1, 2], [1, 2], [1], [2], [1], [1, 2, 3]],
    testingEvidence: evidence(
      'HPLC purity and quantity shown side by side',
      'The same COA reports purity and quantity as separate results. That is first-hand evidence of why a chromatographic area percentage should not be substituted for milligrams in a container.',
    ),
  },
  'what-mass-spectrometry-confirms-in-peptide-testing': {
    reviewer: null,
    diagram: diagram(
      'How intact-mass evidence is interpreted',
      'Observed ions require charge-state interpretation before comparison with a defined theoretical mass.',
      [
        ['Ionize', 'Create gas-phase charged species'],
        ['Measure m/z', 'Record mass-to-charge peaks'],
        ['Resolve charge', 'Identify isotope and charge envelopes'],
        ['Deconvolute', 'Estimate neutral intact mass'],
        ['Compare', 'Match the defined molecule within tolerance'],
      ],
    ),
    sectionCitations: [[1, 2], [1, 2], [2], [3, 4], [3, 4]],
    testingEvidence: evidence(
      'A report that combines chromatography and mass spectrometry',
      'COA #12670 identifies UHPLC with mass spectrometry as the method and includes both chromatographic and full-scan MS pages. The certificate still reports purity, identity, and quantity separately.',
    ),
  },
  'lyophilized-vs-liquid-research-materials': {
    reviewer: null,
    diagram: diagram(
      'Why material format changes the analytical question',
      'Format affects matrix, handling, sampling, and the meaning of the reported result.',
      [
        ['Format', 'Lyophilized cake or finished liquid'],
        ['Matrix', 'Peptide, water, buffers, and excipients'],
        ['Preparation', 'Dissolution, dilution, and sampling plan'],
        ['Method', 'Procedure suited to that matrix'],
        ['Conclusion', 'A result bounded to that sample'],
      ],
    ),
    sectionCitations: [[1, 3], [1, 2, 3], [2], [2, 4], [1, 4]],
    testingEvidence: evidence(
      'Two real formats, two bounded records',
      'The reports below show a lyophilized blend and a finished liquid. They illustrate different sample descriptions, matrices, specifications, and reporting choices; they are not a controlled comparison of format stability.',
      [blendCoa, liquidCoa],
    ),
  },
  'laboratory-storage-and-handling-guide': {
    reviewer: null,
    diagram: diagram(
      'A controlled material-handling path',
      'Local SOPs and product-specific evidence must define the actual limits and actions.',
      [
        ['Receive', 'Inspect, identify, and record condition'],
        ['Store', 'Control temperature, light, moisture, and access'],
        ['Prepare', 'Use a defined sampling and handling procedure'],
        ['Monitor', 'Record excursions and freeze-thaw events'],
        ['Investigate', 'Quarantine and assess deviations'],
      ],
    ),
    sectionCitations: [[1, 3], [1, 2], [1, 2], [1, 2, 4], [3, 4], [3, 4]],
    testingEvidence: evidence(
      'What a release COA does—and does not—say about storage',
      'COA #12670 fixes the tested lot, sample-receipt date, analysis date, and results. It does not document later shipping conditions, storage excursions, freeze-thaw history, or an expiry period; those require separate controlled records and stability evidence.',
    ),
  },
  'how-batch-level-coa-verification-works': {
    reviewer: null,
    diagram: diagram(
      'Batch-level verification workflow',
      'The lookup succeeds only when the physical label and report resolve to the same lot.',
      [
        ['Select lot', 'Identify the material to be sampled'],
        ['Submit sample', 'Record chain of custody and sample ID'],
        ['Test', 'Run defined identity, purity, or assay methods'],
        ['Release record', 'Approve the signed batch report'],
        ['Verify', 'Match the label to the published COA'],
      ],
    ),
    sectionCitations: [[1, 2], [1, 4], [1, 3], [1, 2, 4], [1, 4]],
    testingEvidence: evidence(
      'Follow one lot from label to laboratory report',
      'The product page, COA Library entry, lot SYN-030926, COA number 12670, test dates, results, and named analyst form an auditable chain. A different lot requires its own matching report.',
    ),
  },
  'why-product-lot-numbers-matter': {
    reviewer: null,
    diagram: diagram(
      'One lot number, several linked records',
      'A lot identifier is the join key; it is not itself a test result.',
      [
        ['Container label', 'The physical material'],
        ['Inventory', 'Receipt and location history'],
        ['COA', 'Methods and results for the sampled lot'],
        ['Deviation', 'Excursions or investigations'],
        ['Disposition', 'Release, hold, or corrective action'],
      ],
    ),
    sectionCitations: [[1, 2], [1, 2, 3], [2, 3], [1, 3], [1, 2]],
    testingEvidence: evidence(
      'A lot number as a practical join key',
      'Lot SYN-030926 appears on COA #12670 alongside the sample identity, report dates, analytical method, and results. That shared identifier is what makes a label-to-record verification possible.',
    ),
  },
  'understanding-peptide-sequence-and-molecular-weight': {
    reviewer: null,
    diagram: diagram(
      'From sequence definition to observed mass',
      'Every chemical detail must be defined before theoretical and observed values can be compared.',
      [
        ['Sequence', 'Ordered residues from N- to C-terminus'],
        ['Termini', 'Free, amidated, acetylated, or otherwise capped'],
        ['Modifications', 'Bridges, labels, oxidation, and conjugates'],
        ['Theory', 'Choose average or monoisotopic mass'],
        ['Observation', 'Interpret m/z, charge, adducts, and tolerance'],
      ],
    ),
    sectionCitations: [[1, 3], [1], [1, 2, 3], [2, 4], [1, 2, 3, 4]],
    testingEvidence: evidence(
      'Defined formulas and molecular weights in a batch report',
      'COA #12670 lists BPC-157 and TB-500 separately with their formulas and molecular weights before presenting the LC-MS evidence. Those definitions are necessary context for interpreting identity results.',
    ),
  },
}

export function articleCitationUrls(article) {
  return [...new Set([
    ...article.sources.map((source) => source.url),
    ...(article.testingEvidence?.records || []).map((record) => record.href),
  ])]
}
