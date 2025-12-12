import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handler para OPTIONS (preflight request)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ingredientes } = body;

    if (!ingredientes || !Array.isArray(ingredientes) || ingredientes.length === 0) {
      return NextResponse.json(
        { error: 'Lista de ingredientes é obrigatória' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('Recalculando valores nutricionais para ingredientes:', ingredientes);

    // Prompt otimizado para recálculo usando apenas texto (GPT-4.1-mini)
    const prompt = `Você é um nutricionista especializado. Recalcule os valores nutricionais TOTAIS do prato baseado EXATAMENTE nos ingredientes fornecidos abaixo.

INGREDIENTES DO PRATO:
${ingredientes.map((ing: string, idx: number) => `${idx + 1}. ${ing}`).join('\n')}

INSTRUÇÕES:
1. Analise cada ingrediente e estime a quantidade mais provável
2. Calcule os valores nutricionais de cada ingrediente
3. Some todos os valores para obter o TOTAL do prato
4. Retorne APENAS um JSON válido, sem texto adicional

FORMATO DE RESPOSTA (JSON):
{
  "nome_do_prato": "Nome descritivo do prato",
  "calorias_totais": número (kcal totais do prato),
  "proteinas_g": número (gramas totais),
  "carboidratos_g": número (gramas totais),
  "gorduras_g": número (gramas totais),
  "fibras_g": número (gramas totais),
  "ingredientes_identificados": [
    {
      "nome": "nome do ingrediente",
      "quantidade_estimada": "quantidade com unidade",
      "calorias": número,
      "proteinas_g": número,
      "carboidratos_g": número,
      "gorduras_g": número,
      "fibras_g": número
    }
  ],
  "observacoes": "Observações sobre estimativas ou considerações nutricionais"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini', // Modelo mais barato para texto
      messages: [
        {
          role: 'system',
          content: 'Você é um nutricionista especializado em análise nutricional. Retorne APENAS JSON válido, sem markdown ou texto adicional.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0].message.content?.trim() || '';
    
    // Parse do JSON retornado
    const nutritionalData = JSON.parse(responseText);

    console.log('Recálculo concluído:', {
      prato: nutritionalData.nome_do_prato,
      calorias: nutritionalData.calorias_totais,
      ingredientes: nutritionalData.ingredientes_identificados?.length || 0
    });

    return NextResponse.json(nutritionalData, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Erro ao recalcular valores nutricionais:', error);
    return NextResponse.json(
      { error: 'Erro ao recalcular valores nutricionais', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
