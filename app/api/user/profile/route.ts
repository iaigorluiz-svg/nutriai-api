import { NextRequest, NextResponse } from 'next/server';

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// OPTIONS handler
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Tipo do perfil
interface UserProfile {
  user_id: string;
  gender: 'masculino' | 'feminino';
  birth_year: number;
  weight_kg: number;
  height_cm: number;
  activity_level: 'sedentario' | 'levemente_ativo' | 'moderadamente_ativo' | 'muito_ativo' | 'super_ativo';
  goal_type: 'ganhar' | 'perder' | 'manter';
  goal_weight_kg: number;
  goal_weeks: number;
  daily_calories: number;
  macro_focus: 'equilibrado' | 'perda_gordura' | 'ganho_massa' | 'baixo_carb' | 'cetogenico' | 'personalizado';
  protein_percent: number;
  carbs_percent: number;
  fat_percent: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  notifications_enabled: boolean;
}

// Simulação de banco de dados (substituir por Prisma/Supabase)
const profiles = new Map<string, UserProfile>();

// GET - Buscar perfil
export async function GET(request: NextRequest) {
  try {
    // TODO: Implementar autenticação real
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json(
    //     { error: 'Não autenticado' },
    //     { status: 401, headers: corsHeaders }
    //   );
    // }

    // Por enquanto, pegar user_id do header ou query
    const userId = request.headers.get('x-user-id') || request.nextUrl.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'user_id não fornecido' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Buscar perfil
    const profile = profiles.get(userId);

    if (!profile) {
      return NextResponse.json(
        { error: 'Perfil não encontrado', message: 'Usuário ainda não completou o onboarding' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: true, profile },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Erro ao buscar perfil:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar perfil', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST - Criar ou atualizar perfil
export async function POST(request: NextRequest) {
  try {
    // TODO: Implementar autenticação real
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json(
    //     { error: 'Não autenticado' },
    //     { status: 401, headers: corsHeaders }
    //   );
    // }

    // Parse body
    const body = await request.json();
    const {
      user_id,
      gender,
      birth_year,
      weight_kg,
      height_cm,
      activity_level,
      goal_type,
      goal_weight_kg,
      goal_weeks,
      daily_calories,
      macro_focus,
      protein_percent,
      carbs_percent,
      fat_percent,
      protein_grams,
      carbs_grams,
      fat_grams,
      notifications_enabled
    } = body;

    // Validações básicas
    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id é obrigatório' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!gender || !birth_year || !weight_kg || !height_cm) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando: gender, birth_year, weight_kg, height_cm' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validar ano de nascimento
    const currentYear = new Date().getFullYear();
    if (birth_year < 1920 || birth_year > currentYear) {
      return NextResponse.json(
        { error: `Ano de nascimento inválido. Deve estar entre 1920 e ${currentYear}` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validar idade mínima (13 anos)
    const age = currentYear - birth_year;
    if (age < 13) {
      return NextResponse.json(
        { error: 'Idade mínima é 13 anos' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validar peso
    if (weight_kg < 30 || weight_kg > 200) {
      return NextResponse.json(
        { error: 'Peso deve estar entre 30 e 200 kg' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validar altura
    if (height_cm < 100 || height_cm > 250) {
      return NextResponse.json(
        { error: 'Altura deve estar entre 100 e 250 cm' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validar soma dos macros
    if (protein_percent + carbs_percent + fat_percent !== 100) {
      return NextResponse.json(
        { error: `Soma dos macronutrientes deve ser 100%. Atual: ${protein_percent + carbs_percent + fat_percent}%` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Criar perfil
    const profile: UserProfile = {
      user_id,
      gender,
      birth_year,
      weight_kg,
      height_cm,
      activity_level,
      goal_type,
      goal_weight_kg,
      goal_weeks,
      daily_calories,
      macro_focus,
      protein_percent,
      carbs_percent,
      fat_percent,
      protein_grams,
      carbs_grams,
      fat_grams,
      notifications_enabled: notifications_enabled !== undefined ? notifications_enabled : true
    };

    // Salvar (substituir por banco real)
    const isNew = !profiles.has(user_id);
    profiles.set(user_id, profile);

    console.log(`Perfil ${isNew ? 'criado' : 'atualizado'} para user_id: ${user_id}`);

    const statusCode = isNew ? 201 : 200;

    return NextResponse.json(
      { 
        success: true, 
        profile,
        message: isNew ? 'Perfil criado com sucesso' : 'Perfil atualizado com sucesso'
      },
      { status: statusCode, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Erro ao salvar perfil:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar perfil', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
