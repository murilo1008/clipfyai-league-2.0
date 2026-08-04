// Informações da equipe comercial
export const COMMERCIAL_TEAM = [
    {
      name: 'Murilo Rocha',
      email: 'murilo@clipfyai.com',
      telefone: '(11) 9 xxxx-xxxx', // Adicionar telefone real
    },
    {
      name: 'Daniel',
      email: 'daniel@clipfyai.com',
      telefone: '(11) 9 xxxx-xxxx', // WhatsApp já usado no sistema
    },
    {
      name: 'Ivan',
      email: 'ivan@clipfyai.com',
      telefone: '(11) 9 xxxx-xxxx', // Adicionar telefone real
    },
    {
      name: 'Luiz F. Barreto',
      email: 'luiz.f.barreto@hotmail.com',
      telefone: '(11) 91784-9041', // Adicionar telefone real
    },
    // Adicione mais membros conforme necessário
  ] as const
  
  // Lista apenas dos emails para compatibilidade com código existente
  export const COMMERCIAL_EMAILS = COMMERCIAL_TEAM.map(member => member.email)
  
  export type CommercialTeamMember = typeof COMMERCIAL_TEAM[number]
  export type CommercialEmail = typeof COMMERCIAL_EMAILS[number]
  