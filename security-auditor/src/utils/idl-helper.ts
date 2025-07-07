import { Idl } from '@coral-xyz/anchor';

// Helper to ensure IDL is in the correct format
export function prepareIdl(idl: any): Idl {
  // Ensure the IDL has the required structure
  if (!idl.version || !idl.name || !idl.instructions) {
    throw new Error('Invalid IDL format');
  }
  
  // Return the IDL as-is if it's already in the correct format
  return idl as Idl;
}