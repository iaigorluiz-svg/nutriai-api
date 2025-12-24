import { NextRequest, NextResponse } from 'next/server';

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Multiplicadores de atividade (para TDEE)
const ACTIVITY_MULTIPLIERS = {
  sedentario: 1.2,
  levemente_ativo: 1.375,
  moderadamente_ativo: 1.55,
  muito_ativo: 1.725,
  super_ativo: 1.9
};

// Presets de distribuição de macronutrientes
const MACRO_PRESETS = {
  equilibrado: { protein: 30, carbs: 50, fat: 20 },
  perda_gordura: { protein: 35, carbs: 40, fat: 25 },
  ganho_massa: { protein: 35, carbs: 45, fat: 20 },
  baixo_carb: { protein: 30, carbs: 30, fat: 40 },
  cetogenico: { protein: 25, carbs: 5, fat: 70 }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      gender,
      birth_year,
      weight_kg,
      height_cm,
      activity_level,
      goal_type,
      goal_weight_kg,
      goal_weeks,
      macro_focus
    } = body;

    // Validações
    if (!gender || !birth_year || !weight_kg || !height_cm || !activity_level) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando: gender, birth_year, weight_kg, height_cm, activity_level' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!goal_weight_kg || !goal_weeks) {
      return NextResponse.json(
        { error: 'Campos de meta faltando: goal_weight_kg, goal_weeks' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Calcular idade
    const currentYear = new Date().getFullYear();
    const age = currentYear - birth_year;

    if (age < 13) {
      return NextResponse.json(
        { error: 'Idade mínima é 13 anos' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Calcular IMC atual e meta
    const height_m = height_cm / 100;
    const bmi_current = weight_kg / (height_m * height_m);
    const bmi_goal = goal_weight_kg / (height_m * height_m);

    // Calcular TMB (Taxa Metabólica Basal) usando Mifflin-St Jeor
    let tmb: number;
    if (gender === 'masculino') {
      tmb = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5;
    } else {
      tmb = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161;
    }

    // Calcular TDEE (Total Daily Energy Expenditure)
    const multiplier = ACTIVITY_MULTIPLIERS[activity_level as keyof typeof ACTIVITY_MULTIPLIERS];
    if (!multiplier) {
      return NextResponse.json(
        { error: 'Nível de atividade inválido' },
        { status: 400, headers: corsHeaders }
      );
    }
    const tdee = tmb * multiplier;

    // Calcular mudança de peso necessária
    const weight_change_kg = goal_weight_kg - weight_kg;
    const kg_per_week = weight_change_kg / goal_weeks;

    // Calcular calorias diárias para atingir meta
    // 1 kg de gordura corporal ≈ 7700 kcal
    // Distribuir ao longo da semana (7 dias)
    const calorie_adjustment_per_day = (kg_per_week * 7700) / 7;
    let daily_calories = Math.round(tdee + calorie_adjustment_per_day);

    // Aplicar limites mínimos de segurança
    const min_calories = gender === 'masculino' ? 1500 : 1200;
    const max_calories = 5000;
    
    let calorie_warning = '';
    if (daily_calories < min_calories) {
      calorie_warning = `Calorias ajustadas para o mínimo seguro (${min_calories} kcal/dia)`;
      daily_calories = min_calories;
    } else if (daily_calories > max_calories) {
      calorie_warning = `Calorias ajustadas para o máximo recomendado (${max_calories} kcal/dia)`;
      daily_calories = max_calories;
    }

    // Obter percentuais de macros do preset ou usar padrão
    const macros_percent = MACRO_PRESETS[macro_focus as keyof typeof MACRO_PRESETS] || MACRO_PRESETS.equilibrado;

    // Calcular gramas de macronutrientes
    // Proteína: 4 kcal/g
    // Carboidratos: 4 kcal/g
    // Gordura: 9 kcal/g
    const protein_calories = daily_calories * (macros_percent.protein / 100);
    const carbs_calories = daily_calories * (macros_percent.carbs / 100);
    const fat_calories = daily_calories * (macros_percent.fat / 100);

    const protein_grams = protein_calories / 4;
    const carbs_grams = carbs_calories / 4;
    const fat_grams = fat_calories / 9;

    // Gerar avisos e recomendações
    const warnings: string[] = [];
    
    // Aviso sobre taxa de mudança de peso
    if (Math.abs(kg_per_week) > 1) {
      warnings.push(`Taxa de mudança de peso muito rápida (${Math.abs(kg_per_week).toFixed(2)} kg/semana). Recomendado: máximo 1 kg/semana para saúde.`);
    } else if (Math.abs(kg_per_week) < 0.25) {
      warnings.push(`Taxa de mudança de peso muito lenta (${Math.abs(kg_per_week).toFixed(2)} kg/semana). Considere um período mais curto para resultados mais visíveis.`);
    }

    // Aviso sobre calorias
    if (calorie_warning) {
      warnings.push(calorie_warning);
    }

    // Aviso sobre IMC
    if (bmi_goal < 18.5) {
      warnings.push('IMC meta está abaixo do peso saudável (< 18.5). Consulte um nutricionista.');
    } else if (bmi_goal > 30) {
      warnings.push('IMC meta está acima do peso saudável (> 30). Considere uma meta intermediária.');
    }

    // Classificação do IMC
    const getBMICategory = (bmi: number): string => {
      if (bmi < 18.5) return 'Abaixo do peso';
      if (bmi < 25) return 'Peso normal';
      if (bmi < 30) return 'Sobrepeso';
      return 'Obesidade';
    };

    // Retornar cálculos
    return NextResponse.json({
      success: true,
      calculations: {
        // Dados básicos
        age,
        
        // IMC
        bmi_current: Math.round(bmi_current * 10) / 10,
        bmi_current_category: getBMICategory(bmi_current),
        bmi_goal: Math.round(bmi_goal * 10) / 10,
        bmi_goal_category: getBMICategory(bmi_goal),
        
        // Metabolismo
        tmb: Math.round(tmb),
        tdee: Math.round(tdee),
        
        // Meta de peso
        weight_change_kg: Math.round(weight_change_kg * 10) / 10,
        kg_per_week: Math.round(kg_per_week * 100) / 100,
        goal_type: weight_change_kg > 0 ? 'ganhar' : weight_change_kg < 0 ? 'perder' : 'manter',
        
        // Calorias
        daily_calories,
        calorie_adjustment: Math.round(calorie_adjustment_per_day),
        
        // Macronutrientes
        macros: {
          protein: {
            grams: Math.round(protein_grams * 10) / 10,
            percent: macros_percent.protein,
            calories: Math.round(protein_calories)
          },
          carbs: {
            grams: Math.round(carbs_grams * 10) / 10,
            percent: macros_percent.carbs,
            calories: Math.round(carbs_calories)
          },
          fat: {
            grams: Math.round(fat_grams * 10) / 10,
            percent: macros_percent.fat,
            calories: Math.round(fat_calories)
          }
        },
        
        // Avisos e recomendações
        warnings,
        
        // Tempo estimado
        estimated_completion_date: new Date(Date.now() + goal_weeks * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Erro ao calcular metas:', error);
    return NextResponse.json(
      { error: 'Erro ao calcular metas', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
