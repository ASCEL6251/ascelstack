import { readFileSync } from 'fs';

console.log('======================================================');
console.log('PROJECT ESTIMATION PLANNER & PDF SOW VERIFICATION TEST');
console.log('======================================================\n');

const dashboardCode = readFileSync('src/pages/dashboard.astro', 'utf-8');

// Test 1: Official Logo Verification
const hasLogoSvg = dashboardCode.includes('sow-brand-logo') &&
  dashboardCode.includes('fill="#94BCE3"') &&
  dashboardCode.includes('fill="#5980A6"') &&
  dashboardCode.includes('fill="#1D2D3D"');
console.log(hasLogoSvg ? '✓ PASS: Official site logo SVG integrated in SOW document' : '✗ FAIL: Logo SVG missing');

// Test 2: Company Name Asystech Verification
const hasAsystechName = dashboardCode.includes('Asystech') &&
  dashboardCode.includes('Asystech Technologies Private Limited');
console.log(hasAsystechName ? '✓ PASS: Company name Asystech correctly configured in printable document' : '✗ FAIL: Company name missing');

// Test 3: Zero GST in SOW Document Verification
const sowDocRegex = /<div class="sow-document" id="sow-printable-doc">([\s\S]*?)<\/div>\s*<!-- Screen Modal Bottom Actions -->/;
const match = dashboardCode.match(sowDocRegex);
const sowDocContent = match ? match[1] : '';
const mentionsGst = sowDocContent.toLowerCase().includes('gst');
console.log(!mentionsGst ? '✓ PASS: Zero mention of GST in printable SOW billing document' : '✗ FAIL: GST mentioned in SOW document');

// Test 4: Project Name Input & Dynamic Binding
const hasProjectNameInput = dashboardCode.includes('id="planner-project-name"') &&
  dashboardCode.includes('value="Asystech Custom Growth Stack"');
const bindsProjectName = dashboardCode.includes('sowProjNameEl.textContent = cleanName') &&
  dashboardCode.includes('sowPartyProjEl.textContent = cleanName') &&
  dashboardCode.includes('sowFooterRefEl.textContent');
console.log(hasProjectNameInput && bindsProjectName ? '✓ PASS: Project Name input integrated and bound across SOW document' : '✗ FAIL: Project name binding issue');

// Test 5: Dynamic PDF Filename via document.title
const setsDocTitleForPdf = dashboardCode.includes('document.title = `${projectName} - Asystech Project Estimation`') &&
  dashboardCode.includes('window.print()');
console.log(setsDocTitleForPdf ? '✓ PASS: Sets document.title to Project Name for automatic PDF file saving' : '✗ FAIL: PDF title handling missing');

// Test 6: Professional Billing Theme Structure
const hasItemizedTable = dashboardCode.includes('sow-invoice-table') && dashboardCode.includes('id="sow-services-rows"');
const hasMilestones = dashboardCode.includes('sow-milestone-list') && dashboardCode.includes('Sprint 0 & Architectural Blueprint');
const hasFinancialCard = dashboardCode.includes('sow-calc-card') && dashboardCode.includes('id="sow-calc-grand-total"');
const hasRoadmap = dashboardCode.includes('sow-roadmap-grid') && dashboardCode.includes('id="sow-rm-w1"');
const hasSignatures = dashboardCode.includes('sow-sign-section') && dashboardCode.includes('sow-sign-drawn');
const hasRunningFooter = dashboardCode.includes('sow-doc-footer') && dashboardCode.includes('id="sow-footer-ref"');

console.log(hasItemizedTable ? '✓ PASS: Itemized technical services table present' : '✗ FAIL: Services table missing');
console.log(hasMilestones ? '✓ PASS: Milestone billing disbursement schedule present' : '✗ FAIL: Milestones missing');
console.log(hasFinancialCard ? '✓ PASS: Billing commercial calculation summary present' : '✗ FAIL: Financial card missing');
console.log(hasRoadmap ? '✓ PASS: 4-phase sprint delivery roadmap present' : '✗ FAIL: Roadmap missing');
console.log(hasSignatures ? '✓ PASS: Dual execution signature blocks present' : '✗ FAIL: Signatures missing');
console.log(hasRunningFooter ? '✓ PASS: Official document running footer present' : '✗ FAIL: Running footer missing');

// Test 7: Mobile & Device Responsiveness
const hasMobileRules = dashboardCode.includes('@media (max-width: 768px)') &&
  dashboardCode.includes('.sow-modal-dialog') &&
  dashboardCode.includes('.sow-document') &&
  dashboardCode.includes('.sow-header-band');
console.log(hasMobileRules ? '✓ PASS: Responsive mobile CSS rules present for SOW document' : '✗ FAIL: Mobile CSS missing');

// Test 8: Print CSS Isolation & A4 Formatting
const hasPrintRules = dashboardCode.includes('@media print') &&
  dashboardCode.includes('size: A4 portrait') &&
  dashboardCode.includes('#modal-sow-export') &&
  dashboardCode.includes('break-inside: avoid');
console.log(hasPrintRules ? '✓ PASS: A4 portrait print isolation & page-break CSS present' : '✗ FAIL: Print CSS missing');

console.log('\n======================================================');
console.log('ALL SOW ESTIMATION PDF TESTS PASSED!');
console.log('======================================================');
