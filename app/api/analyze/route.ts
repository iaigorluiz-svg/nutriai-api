import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Configurar OpenAI
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
    // Parse request body
    const body = await request.json();
    const { image, userId, timestamp } = body;

    // Validar campos obrigatórios
    if (!image) {
      return NextResponse.json(
        { error: 'Campo "image" é obrigatório' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('Analisando imagem para userId:', userId);
    console.log('URL da imagem:', image);

    // ============================================================
    // ALTERNATIVA 1: PROMPT OTIMIZADO COM CHAIN-OF-THOUGHT
    // ============================================================
    // Este prompt guia o modelo a raciocinar passo a passo,
    // resultando em análises mais precisas e detalhadas.
    // ============================================================
    
    const systemPrompt = `Você é um analista nutricional especializado. Analise imagens de alimentos seguindo este processo passo a passo:

1. IDENTIFICAÇÃO: Liste todos os alimentos e ingredientes visíveis na imagem.
2. ESTIMATIVA DE QUANTIDADE: Para cada item, estime o peso ou volume em gramas/ml baseando-se no tamanho visual e porções típicas.
3. CÁLCULO INDIVIDUAL: Calcule os macronutrientes de cada ingrediente baseado na quantidade estimada, usando seus conhecimentos de tabelas nutricionais.
4. CONSOLIDAÇÃO: Some todos os valores e retorne em formato JSON.

O JSON final deve conter:
- nome_do_prato: string (nome descritivo do prato)
- calorias_totais: number (soma total de calorias)
- proteinas_g: number (soma total de proteínas em gramas)
- carboidratos_g: number (soma total de carboidratos em gramas)
- gorduras_g: number (soma total de gorduras em gramas)
- fibras_g: number (soma total de fibras em gramas)
- ingredientes_identificados: array de objetos com:
  {
    nome: string,
    quantidade_estimada: string,
    calorias: number,
    proteinas: number,
    carboidratos: number,
    gorduras: number,
    fibras: number
  }
- observacoes_nutricionais: string (observações sobre a refeição, dicas nutricionais)

Seja preciso nas estimativas e transparente sobre o raciocínio.`;

    // Chamar OpenAI GPT-4o Vision API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analise esta imagem de comida e forneça uma análise nutricional detalhada seguindo o processo passo a passo descrito.'
            },
            {
              type: 'image_url',
              image_url: {
                url: image,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7, // Equilíbrio entre criatividade e precisão
    });

    // Extrair e parsear o conteúdo da resposta
    const analysisResult = JSON.parse(response.choices[0].message.content || '{}');

    // Log para monitoramento (opcional - pode ser removido em produção)
    console.log('Análise concluída:', {
      userId,
      prato: analysisResult.nome_do_prato,
      calorias: analysisResult.calorias_totais,
      ingredientes: analysisResult.ingredientes_identificados?.length || 0
    });

    // Retornar o resultado da análise com sucesso
    return NextResponse.json(analysisResult, { headers: corsHeaders });

  } catch (error) {
    console.error('Erro na API de análise:', error);
    
    // Retornar erro detalhado para debug (em produção, considere mensagens mais genéricas)
    return NextResponse.json(
      { 
        error: 'Ocorreu um erro ao analisar a imagem.',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
