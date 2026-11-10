/**
 * Standard 25 Agreement Clauses for Ascelstack Professional Service Agreement (PSA)
 * Structured in accordance with applicable Indian laws:
 * - Indian Contract Act, 1872
 * - Information Technology Act, 2000 (Section 10A Electronic Contracts)
 * - Arbitration and Conciliation Act, 1996
 * - Digital Personal Data Protection Act, 2023
 *
 * NOTE: These clauses are fully customizable and subject to review by qualified Indian legal counsel.
 */

export interface AgreementClause {
  id: string;
  sectionNumber: number;
  title: string;
  category: 'parties' | 'scope' | 'commercials' | 'operations' | 'ip_legal' | 'execution';
  content: string;
  customNotes?: string;
  isMandatory: boolean;
  isCustomizable: boolean;
}

export interface AgreementTemplate {
  id?: string;
  code: string;
  name: string;
  category: string;
  description: string;
  clauses: AgreementClause[];
}

export const DEFAULT_COMPANY_INFO = {
  legalName: 'Ascelstack Technologies Private Limited',
  brandName: 'Ascelstack',
  address: 'Sector V, Bidhannagar, Salt Lake, Kolkata, West Bengal 700091, India',
  email: 'legal@ascelstack.com',
  supportEmail: 'support@ascelstack.com',
  phone: '+91 89428 41651',
  gstin: '',
  gstinEnabled: false,
  signatoryName: 'Authorized Signatory',
  signatoryTitle: 'Director / Legal Counsel',
  defaultCurrency: 'INR',
  logoUrl: '/brand/mark.svg',
};

export const STANDARD_25_CLAUSES: AgreementClause[] = [
  {
    id: 'clause-1-provider',
    sectionNumber: 1,
    title: 'Service Provider Information',
    category: 'parties',
    isMandatory: true,
    isCustomizable: true,
    content:
      'This Professional Service Agreement ("Agreement") is entered into by and between Ascelstack Technologies Private Limited ("Service Provider", "Ascelstack", "we", "us", or "our"), a company duly incorporated under the provisions of the Companies Act, 2013, having its registered and operational office at Sector V, Bidhannagar, Salt Lake, Kolkata, West Bengal 700091, India (Email: legal@ascelstack.com), and the Client named in Section 2 herein. Service Provider warrants that it holds full corporate power and requisite authorizations to enter into, execute, and deliver this Agreement and all Statements of Work ("SOW") governed hereby.',
  },
  {
    id: 'clause-2-client',
    sectionNumber: 2,
    title: 'Client Information',
    category: 'parties',
    isMandatory: true,
    isCustomizable: true,
    content:
      'The party procuring professional services hereunder is {{client_name}} representing {{client_company}} ("Client", "you", or "your"), with its principal business address at {{client_address}}, {{client_city}}, {{client_state}}, {{client_country}} (Email: {{client_email}}, Phone: {{client_phone}}). Client warrants that the authorized signatory executing this Agreement possesses full corporate, partnership, or individual legal capacity to bind the Client to all terms and conditions set forth herein.',
  },
  {
    id: 'clause-3-project-overview',
    sectionNumber: 3,
    title: 'Project Name and Description',
    category: 'scope',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Project Title: {{project_name}}\n\nProject Overview & Objectives: {{project_description}}\n\nService Provider shall provide comprehensive technical, creative, and operational engineering services across Ascelstack\'s unified delivery framework to achieve the core business objectives, system specifications, and performance criteria defined herein.',
  },
  {
    id: 'clause-4-scope-of-work',
    sectionNumber: 4,
    title: 'Scope of Work (SOW)',
    category: 'scope',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Detailed Scope of Work:\n{{scope_of_work}}\n\nExplicit Exclusions (Out of Scope):\nAny technical integration, feature development, custom graphic production, or operational service not specifically detailed in this Section or an executed Change Request Order shall be considered strictly out of scope. Third-party statutory filing fees, government compliance duties, paid advertising media budgets, and direct third-party cloud infrastructure expenses are excluded from baseline engineering fees.',
  },
  {
    id: 'clause-5-deliverables',
    sectionNumber: 5,
    title: 'Project Deliverables',
    category: 'scope',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Service Provider agrees to deliver the specific items itemized below upon satisfactory completion of respective sprint milestones:\n{{deliverables_list}}\n\nAll digital deliverables shall be submitted in standard production formats, including version-controlled Git code repositories, compiled artifacts, architectural documentation, and administrative credentials as applicable.',
  },
  {
    id: 'clause-6-timeline-milestones',
    sectionNumber: 6,
    title: 'Project Timeline and Milestones',
    category: 'operations',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Estimated Project Duration: {{project_timeline}}\n\nMilestone Delivery Schedule:\n{{milestones_schedule}}\n\nClient Review & Acceptance Window: Upon delivery of each milestone sprint, Client shall have five (5) business days ("UAT Period") to review and test the deliverables against agreed specifications. Deliverables shall be deemed accepted if written confirmation is provided or if no specific written deficiency list is furnished prior to the expiry of the UAT Period.',
  },
  {
    id: 'clause-7-total-cost',
    sectionNumber: 7,
    title: 'Total Project Cost',
    category: 'commercials',
    isMandatory: true,
    isCustomizable: true,
    content:
      'The total contracted project investment for services detailed in this Agreement is {{currency}} {{total_amount}} ({{total_amount_words}}).\n\nTaxes: Taxes shall be levied strictly in accordance with applicable Indian Goods and Services Tax ("GST") laws under CGST, SGST, or IGST statutes only if an official GST invoice is formally issued with verified GST registration details. If GST is not applicable or enabled, no GST surcharge shall be billed.',
  },
  {
    id: 'clause-8-advance-payment',
    sectionNumber: 8,
    title: 'Advance Payment',
    category: 'commercials',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Prior to project mobilization, sprint planning, and repository initialization, Client shall remit an initial advance payment of {{currency}} {{advance_amount}} (representing {{advance_percentage}}% of the total project cost). Service Provider shall not be obligated to commence engineering, allocate dedicated engineers, or configure third-party development environments until cleared advance funds have been received in Service Provider\'s designated bank account.',
  },
  {
    id: 'clause-9-payment-schedule',
    sectionNumber: 9,
    title: 'Payment Schedule',
    category: 'commercials',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Payment Milestones & Invoicing Triggers:\n{{payment_schedule}}\n\nAll invoices issued by Service Provider are payable within seven (7) business days of invoice date ("Due Date"). Payments shall be remitted via Electronic Funds Transfer (NEFT, RTGS, IMPS), UPI, or designated authorized digital gateway accounts.',
  },
  {
    id: 'clause-10-late-payment',
    sectionNumber: 10,
    title: 'Late Payment Policy',
    category: 'commercials',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Any undisputed amount remaining unpaid after a grace period of seven (7) calendar days past the Due Date shall incur simple interest at the rate of 1.5% per month (or the maximum rate permitted under Indian commercial law), computed daily from the Due Date until full settlement. In the event of non-payment exceeding fifteen (15) calendar days, Service Provider reserves the right, after three (3) days written notice, to pause active development, suspend staging server access, and withhold subsequent milestone releases without liability.',
  },
  {
    id: 'clause-11-revision-policy',
    sectionNumber: 11,
    title: 'Revision Policy',
    category: 'operations',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Each milestone deliverable includes up to two (2) consolidated rounds of standard design and functional revisions, provided requested changes align with original specifications and are submitted within the five (5) day UAT Period. Revisions requesting structural modifications, new technical capabilities, alternate database schemas, or fundamental UI redesigns outside original wireframes shall be handled via the Change Request procedure.',
  },
  {
    id: 'clause-12-change-requests',
    sectionNumber: 12,
    title: 'Additional Work and Change Requests',
    category: 'operations',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Either party may request alterations, additions, or reductions to the Scope of Work. Upon receipt of such request, Service Provider shall prepare a written Change Request Order ("CRO") stating the technical scope, timeline impact, and associated cost adjustments. No change request shall take effect or be executed until formally accepted and digitally approved in writing by authorized representatives of both parties.',
  },
  {
    id: 'clause-13-client-responsibilities',
    sectionNumber: 13,
    title: 'Client Responsibilities',
    category: 'operations',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Client agrees to: (a) provide timely access to necessary business materials, brand assets, APIs, staging credentials, and third-party vendor platforms; (b) furnish consolidated feedback on demo sprints within the agreed UAT window; (c) designate a single Authorized Project Manager empowered to approve deliverables and make binding project decisions; and (d) verify accuracy of all legal and corporate information submitted for statutory filings.',
  },
  {
    id: 'clause-14-ip-rights',
    sectionNumber: 14,
    title: 'Intellectual Property Rights',
    category: 'ip_legal',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Service Provider acknowledges that all custom application code, bespoke graphic assets, and custom documentation developed exclusively for Client under this SOW ("Foreground IP") shall, upon receipt of full and final cleared payment of all contracted fees, become the sole and exclusive intellectual property of the Client. Service Provider retains all right, title, and interest in its pre-existing developer toolkits, starter templates, algorithmic utilities, and reusable boilerplate libraries ("Background IP"), granting Client a perpetual, worldwide, non-exclusive, royalty-free license to use Background IP solely as embedded within the delivered project.',
  },
  {
    id: 'clause-15-source-code-ownership',
    sectionNumber: 15,
    title: 'Source Code Ownership',
    category: 'ip_legal',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Upon full settlement of all outstanding invoices, Service Provider shall execute complete and frictionless handover of all custom software source code, database migration scripts, architectural diagrams, Docker configurations, and associated environment secrets to Client\'s designated version control organization (e.g., GitHub, GitLab, or Bitbucket) and cloud hosting accounts.',
  },
  {
    id: 'clause-16-confidentiality-nda',
    sectionNumber: 16,
    title: 'Confidentiality and NDA',
    category: 'ip_legal',
    isMandatory: true,
    isCustomizable: true,
    content:
      'During the term of this Agreement and for a period of three (3) years thereafter, both parties agree to hold in strict confidence all non-public technical, commercial, financial, and strategic data disclosed by either party ("Confidential Information"). Confidential Information shall not be disclosed to any third party without prior written consent, except to employees, subcontractors, and legal counsel who require access on a strict need-to-know basis and are bound by confidentiality obligations no less restrictive than those herein. Both parties shall comply with the provisions of the Digital Personal Data Protection Act, 2023 (India) regarding any personal data processed under this engagement.',
  },
  {
    id: 'clause-17-third-party-expenses',
    sectionNumber: 17,
    title: 'Third-Party Services and Expenses',
    category: 'commercials',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Direct recurring costs for external third-party services—including cloud infrastructure (AWS, Cloudflare, Google Cloud, Neon), SMS/WhatsApp business gateways (Twilio, Gupshup), AI model inference APIs (OpenAI, Anthropic), payment gateway transactional discount rates (Razorpay, Stripe), domain registrations, and statutory government filing fees—are the direct commercial responsibility of Client and shall be billed directly to Client\'s payment methods.',
  },
  {
    id: 'clause-18-maintenance-support',
    sectionNumber: 18,
    title: 'Maintenance and Support',
    category: 'operations',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Service Provider provides a thirty (30) calendar day complimentary bug-fix warranty ("Warranty Period") commencing immediately upon final project deployment or handover. This warranty covers the prompt rectification of software defects, unexpected runtime crashes, or deviations from approved specifications. Ongoing technical support, system patching, OS upgrades, SLA retainers, or feature enhancements beyond the Warranty Period may be engaged under a separate Ascelstack Managed Services Retainer.',
  },
  {
    id: 'clause-19-warranty-limitations',
    sectionNumber: 19,
    title: 'Warranty and Limitations',
    category: 'ip_legal',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Service Provider warrants that services shall be performed in a professional, workmanlike manner adhering to current software engineering standards. EXCEPT AS EXPRESSLY SET FORTH HEREIN, ALL SERVICES AND DELIVERABLES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. SERVICE PROVIDER DISCLAIMS ALL OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR SYSTEM COMPATIBILITY WITH UNAPPROVED THIRD-PARTY SOFTWARE ALTERATIONS.',
  },
  {
    id: 'clause-20-cancellation-termination',
    sectionNumber: 20,
    title: 'Cancellation and Termination',
    category: 'ip_legal',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Either party may terminate this Agreement without cause upon thirty (30) days prior written notice to the other party. Either party may terminate immediately upon written notice if the other party: (a) commits a material breach of this Agreement and fails to remedy such breach within fifteen (15) calendar days of formal notice; or (b) becomes insolvent, files for bankruptcy, or undergoes corporate dissolution. In the event of termination, Client shall pay Service Provider for all services rendered and verified milestone expenses incurred up to the effective termination date.',
  },
  {
    id: 'clause-21-refund-policy',
    sectionNumber: 21,
    title: 'Refund Policy',
    category: 'commercials',
    isMandatory: true,
    isCustomizable: true,
    content:
      'Initial advance mobilization payments are committed towards dedicated engineering scheduling, software architecture, and sprint mobilization and are strictly non-refundable once engineering kickoff has occurred. In the event of project cancellation prior to completion, any unexpended milestone funds held in reserve shall be calculated on a pro-rata basis of actual hours logged and refunded to Client within twenty-one (21) business days.',
  },
  {
    id: 'clause-22-limitation-of-liability',
    sectionNumber: 22,
    title: 'Limitation of Liability',
    category: 'ip_legal',
    isMandatory: true,
    isCustomizable: true,
    content:
      'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE INDIAN LAW, NEITHER PARTY SHALL BE LIABLE TO THE OTHER FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, DATA, BUSINESS REPUTATION, OR DOWNTIME. IN ALL CIRCUMSTANCES, SERVICE PROVIDER\'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR IN CONNECTION WITH THIS AGREEMENT SHALL BE STRICTLY LIMITED TO THE ACTUAL FEES PAID BY CLIENT TO SERVICE PROVIDER UNDER THE SPECIFIC STATEMENT OF WORK IN THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE OCCURRENCE GIVING RISE TO LIABILITY.',
  },
  {
    id: 'clause-23-dispute-resolution',
    sectionNumber: 23,
    title: 'Dispute Resolution',
    category: 'ip_legal',
    isMandatory: true,
    isCustomizable: true,
    content:
      'In the event of any controversy, claim, or dispute arising out of or relating to this Agreement, the parties shall first attempt to resolve the matter through good-faith executive negotiations for thirty (30) calendar days. If unresolved, the dispute shall be finally settled by binding arbitration in accordance with the Arbitration and Conciliation Act, 1996 (India). The arbitral tribunal shall consist of a sole arbitrator mutually appointed by both parties. The seat and venue of arbitration shall be Kolkata or Bengaluru, India, and the proceedings shall be conducted exclusively in the English language.',
  },
  {
    id: 'clause-24-governing-law',
    sectionNumber: 24,
    title: 'Governing Law and Jurisdiction',
    category: 'ip_legal',
    isMandatory: true,
    isCustomizable: true,
    content:
      'This Agreement shall be governed by, construed, and enforced in accordance with the substantive laws of the Republic of India, without reference to its conflict of law principles. Subject to Section 23 (Dispute Resolution), the competent courts situated in Kolkata, West Bengal or Bengaluru, Karnataka shall have exclusive jurisdiction over all matters arising hereunder.',
  },
  {
    id: 'clause-25-electronic-signature',
    sectionNumber: 25,
    title: 'Electronic Signature and Agreement Validity',
    category: 'execution',
    isMandatory: true,
    isCustomizable: true,
    content:
      'The parties explicitly agree that this Agreement may be executed through electronic signature workflows pursuant to Section 10A of the Information Technology Act, 2000 (India). Digital or electronic signatures affixed hereto—whether typed, drawn, or captured via digital cryptographic hashes—shall hold the same legal force, validity, and enforceability as original handwritten wet ink signatures. Both parties represent that they have had the full opportunity to seek independent legal review by an Indian legal practitioner prior to execution.\n\nNOTICE: This electronic signing workflow provides an electronic contract execution under the IT Act, 2000 and is not represented as an Aadhaar-based eSign or statutory Digital Signature Certificate (DSC) issued under CCA guidelines.',
  },
];

export const PRESET_TEMPLATES: AgreementTemplate[] = [
  {
    code: 'AGT-WEB-DEV',
    name: 'Software, Web & App Development Master Agreement',
    category: 'Technology & Software',
    description:
      'Standard comprehensive master agreement for bespoke web platforms, mobile apps, SaaS applications, and cloud architecture builds.',
    clauses: STANDARD_25_CLAUSES,
  },
  {
    code: 'AGT-AI-OPS',
    name: 'AI Agent & Automation Retainer Agreement',
    category: 'AI & Automation',
    description:
      'Specialized agreement tailored for autonomous AI agents, workflow automation pipelines, CRM integrations, and continuous care SLAs.',
    clauses: STANDARD_25_CLAUSES,
  },
  {
    code: 'AGT-GROWTH',
    name: 'Digital Marketing & Growth Retainer Agreement',
    category: 'Marketing & Brand',
    description:
      'Standard agreement for SEO, performance marketing, brand identity design, and marketplace operations.',
    clauses: STANDARD_25_CLAUSES,
  },
  {
    code: 'AGT-ENTERPRISE',
    name: 'Full-Stack Enterprise Systems Agreement',
    category: 'Enterprise Solutions',
    description:
      'Complete end-to-end agreement covering multi-layer Build, Grow, and Run engineering with custom IP and SLA provisions.',
    clauses: STANDARD_25_CLAUSES,
  },
];
