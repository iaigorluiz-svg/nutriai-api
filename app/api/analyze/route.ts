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
      temperature: 0.7,
    });

    // ===== FIX: MELHOR TRATAMENTO DE RESPOSTA VAZIA =====
    const content = response.choices[0].message.content;
    
    if (!content || content.trim() === '' || content === '{}') {
      console.error('❌ OpenAI retornou resposta vazia!');
      console.error('Detalhes da resposta:', JSON.stringify(response, null, 2));
      
      return NextResponse.json(
        { 
          error: 'A análise não pôde ser concluída',
          details: 'OpenAI retornou resposta vazia. Possíveis causas: créditos esgotados, rate limit atingido ou problema com a API Key.',
          debug: {
            model: response.model,
            finish_reason: response.choices[0].finish_reason,
            usage: response.usage
          }
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // Extrair e parsear o conteúdo da resposta
    const analysisResult = JSON.parse(content);

    // Validar se o resultado tem os campos esperados
    if (!analysisResult.calorias_totais && !analysisResult.nome_do_prato) {
      console.error('❌ Resposta da OpenAI não contém campos esperados');
      
      return NextResponse.json(
        { 
          error: 'Resposta inválida da análise',
          details: 'A análise não retornou os campos nutricionais esperados.',
          raw_response: analysisResult
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // Log para monitoramento
    console.log('✅ Análise concluída:', {
      userId,
      prato: analysisResult.nome_do_prato,
      calorias: analysisResult.calorias_totais,
      ingredientes: analysisResult.ingredientes_identificados?.length || 0,
      tokens_used: response.usage?.total_tokens || 0
    });

    // Retornar o resultado da análise com sucesso
    return NextResponse.json(analysisResult, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Erro na API de análise:', error);
    
    // Tratamento específico para erros da OpenAI
    if (error instanceof Error) {
      // Erro de autenticação
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { 
            error: 'Erro de autenticação com OpenAI',
            details: 'API Key inválida ou expirada. Verifique as configurações.'
          },
          { status: 500, headers: corsHeaders }
        );
      }

      // Erro de rate limit
      if (error.message.includes('429') || error.message.includes('Rate limit')) {
        return NextResponse.json(
          { 
            error: 'Limite de requisições atingido',
            details: 'Muitas requisições em pouco tempo. Aguarde alguns instantes e tente novamente.'
          },
          { status: 429, headers: corsHeaders }
        );
      }

      // Erro de quota/créditos
      if (error.message.includes('quota') || error.message.includes('insufficient_quota')) {
        return NextResponse.json(
          { 
            error: 'Créditos esgotados',
            details: 'Sem créditos disponíveis na conta OpenAI. Adicione créditos para continuar.'
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }
    
    // Retornar erro genérico com detalhes
    return NextResponse.json(
      { 
        error: 'Ocorreu um erro ao analisar a imagem.',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
