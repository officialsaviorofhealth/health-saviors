// Hospital Plugin — Adapter Pattern
// DEFERRED: NullHospitalAdapter until partnership confirmed
// TO INTEGRATE: 1) Implement IHospitalAdapter 2) Update factory 3) Set env vars
import { IHospitalAdapter, NullHospitalAdapter } from "../../../../packages/shared/types";
let _adapter: IHospitalAdapter | null = null;
export function getHospitalAdapter(): IHospitalAdapter {
  if (_adapter) return _adapter;
  // TODO: if (process.env.HOSPITAL_API_ENDPOINT) return new AIListedCompanyAdapter(...)
  _adapter = new NullHospitalAdapter();
  return _adapter;
}
export async function isHospitalAvailable(): Promise<boolean> {
  try { return await getHospitalAdapter().healthCheck(); } catch { return false; }
}
