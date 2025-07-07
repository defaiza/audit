import defaiSwapIdl from '@/idl/defai_swap.json'
import defaiStakingIdl from '@/idl/defai_staking.json'
import defaiEstateIdl from '@/idl/defai_estate.json'

// Note: defai_app_factory IDL is missing, we'll need to handle that

export const IDLs = {
  '3WeYbjGoiTQ6qZ8s9Ek6sUZCy2FzG7b9NbGfbVCtHS2n': defaiSwapIdl,
  '3sKj7jgDkiT3hroWho3YZSWAfcmpXXucNKipN4vC3EFM': defaiStakingIdl,
  '2zkarMr8w1k6t1jjcZvmcfVPoFnKy3b1kbxEZH6aATJi': defaiEstateIdl,
  'Ckp11QQpgdP8poYAPVdVjaA5yqfk9Kc4Bd3zmKfzhFAZ': null // App factory IDL missing
}

export function getIdl(programId: string) {
  return IDLs[programId as keyof typeof IDLs]
}