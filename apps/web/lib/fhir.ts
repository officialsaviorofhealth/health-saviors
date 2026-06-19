// HL7 FHIR R4 Resource Builders for health data storage

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: { lastUpdated: string; profile?: string[] };
  [key: string]: any;
}

export function createObservation(params: {
  patientId: string;
  code: string;
  display: string;
  value: number | string;
  unit?: string;
  category: 'vital-signs' | 'survey' | 'social-history' | 'activity';
  effectiveDateTime?: string;
}): FhirResource {
  return {
    resourceType: 'Observation',
    meta: { lastUpdated: new Date().toISOString(), profile: ['http://hl7.org/fhir/StructureDefinition/Observation'] },
    status: 'final',
    category: [{
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: params.category }],
    }],
    code: {
      coding: [{ system: 'http://loinc.org', code: params.code, display: params.display }],
    },
    subject: { reference: `Patient/${params.patientId}` },
    effectiveDateTime: params.effectiveDateTime || new Date().toISOString(),
    valueQuantity: typeof params.value === 'number'
      ? { value: params.value, unit: params.unit || '', system: 'http://unitsofmeasure.org' }
      : undefined,
    valueString: typeof params.value === 'string' ? params.value : undefined,
  };
}

export function createCondition(params: {
  patientId: string;
  code: string;
  display: string;
  severity?: 'mild' | 'moderate' | 'severe';
  onsetDateTime?: string;
}): FhirResource {
  return {
    resourceType: 'Condition',
    meta: { lastUpdated: new Date().toISOString() },
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'unconfirmed' }] },
    severity: params.severity ? {
      coding: [{ system: 'http://snomed.info/sct', code: params.severity === 'severe' ? '24484000' : params.severity === 'moderate' ? '6736007' : '255604002', display: params.severity }],
    } : undefined,
    code: { coding: [{ system: 'http://snomed.info/sct', code: params.code, display: params.display }] },
    subject: { reference: `Patient/${params.patientId}` },
    onsetDateTime: params.onsetDateTime || new Date().toISOString(),
  };
}

export function createEncounter(params: {
  patientId: string;
  agentType: string;
  triageLevel?: string;
  department?: string;
}): FhirResource {
  return {
    resourceType: 'Encounter',
    meta: { lastUpdated: new Date().toISOString() },
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
    type: [{ coding: [{ system: 'http://snomed.info/sct', code: '185317003', display: 'Telephone encounter' }], text: `AI ${params.agentType} consultation` }],
    subject: { reference: `Patient/${params.patientId}` },
    period: { start: new Date().toISOString() },
    priority: params.triageLevel ? {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority', code: params.triageLevel }],
    } : undefined,
    serviceType: params.department ? { coding: [{ display: params.department }] } : undefined,
  };
}

export function createPatient(params: {
  id: string;
  age: number;
  heightCm: number;
  weightKg: number;
}): FhirResource {
  const birthYear = new Date().getFullYear() - params.age;
  return {
    resourceType: 'Patient',
    id: params.id,
    meta: { lastUpdated: new Date().toISOString(), profile: ['http://hl7.org/fhir/StructureDefinition/Patient'] },
    active: true,
    birthDate: `${birthYear}-01-01`,
    extension: [
      { url: 'http://hl7.org/fhir/StructureDefinition/patient-height', valueQuantity: { value: params.heightCm, unit: 'cm' } },
      { url: 'http://hl7.org/fhir/StructureDefinition/patient-weight', valueQuantity: { value: params.weightKg, unit: 'kg' } },
    ],
  };
}
