import { NextRequest, NextResponse } from 'next/server';
import { handleAPIError } from '@/lib/middleware'; // Import middleware kamu

export async function POST(req: NextRequest) {
  try {
    const { origin_village_code, destination_village_code, weight, courier } = await req.json();

    if (!origin_village_code || !destination_village_code || !weight) {
      throw new Error('Missing required fields: origin_village_code, destination_village_code, weight');
    }

    // Bangun URL dengan query parameters
    // Perbaiki URL dari 'https://use.api.co.id/expedition/shipping-cost  ' menjadi tanpa spasi di akhir
    const url = new URL('https://use.api.co.id/expedition/shipping-cost');
    url.searchParams.append('origin_village_code', origin_village_code);
    url.searchParams.append('destination_village_code', destination_village_code);
    url.searchParams.append('weight', weight.toString());
    if (courier) {
      url.searchParams.append('courier', courier);
    }

    // Kirim ke api.co.id
    const response = await fetch(url.toString(), {
      method: 'GET', // Gunakan GET karena API.co.id mengharapkan query params
      headers: {
        'x-api-co-id': process.env.API_CO_ID_KEY || '',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API.co.id HTTP Error:', response.status, errorText);
      throw new Error(`API.co.id Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('API.co.id Raw Response:', data);

    if (!data.is_success || !data.data || !Array.isArray(data.data.couriers)) {
      console.error('API.co.id response structure invalid:', data);
      throw new Error('Invalid response structure from API.co.id');
    }

    // Format data untuk frontend
    const formattedData = data.data.couriers.map((item: any) => ({
      service: item.courier_name || item.courier_code || 'Unknown Service',
      description: `(${item.courier_code}) ${item.estimation || 'Estimasi tidak tersedia'}`,
      value: item.price,
      etd: item.estimation || 'N/A'
    }));

    return NextResponse.json({
      success: true,
       formattedData
    });

  } catch (err: any) {
    console.error('API.co.id error:', err);
    // Gunakan middleware handleAPIError untuk menangani error
    return handleAPIError(err, 'POST /api/rajaongkir/estimate');
  }
}