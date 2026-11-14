import {isCircuitDocument,type CircuitDocument} from '../circuit/types';
import {isDigitalDocument,type DigitalDocument} from '../digital/types';
export type ProjectLab='analog'|'signal'|'computer';
export type ProjectSnapshot={document:CircuitDocument|DigitalDocument;drafts?:Record<string,string>};
export type SavedProject={id:string;name:string;savedAt:string;snapshot:ProjectSnapshot};
export function validSnapshot(input:unknown,lab:ProjectLab):input is ProjectSnapshot{
  if(!input||typeof input!=='object')return false;
  const snapshot=input as ProjectSnapshot;
  if(!(lab==='analog'?isCircuitDocument(snapshot.document):isDigitalDocument(snapshot.document)))return false;
  if(snapshot.drafts!==undefined){
    if(!snapshot.drafts||typeof snapshot.drafts!=='object'||Array.isArray(snapshot.drafts))return false;
    if(Object.entries(snapshot.drafts).some(([id,source])=>id.length>100||typeof source!=='string'||source.length>8192))return false;
  }
  return true;
}
export function parseSavedProjects(input:unknown,lab:ProjectLab):SavedProject[]{
  if(!Array.isArray(input)||input.length>12)throw new Error('This project shelf is invalid. The working circuit has been kept.');
  for(const item of input){
    if(!item||typeof item.id!=='string'||item.id.length>100||typeof item.name!=='string'||item.name.length>90||
      typeof item.savedAt!=='string'||!Number.isFinite(Date.parse(item.savedAt))||!validSnapshot(item.snapshot,lab))
      throw new Error('A saved project could not be read. The working circuit has been kept.');
  }
  return input;
}
