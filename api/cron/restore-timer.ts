import { createClient } from '@supabase/supabase-js';

// Environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key-here';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: any, res: any) {
    // Verify cron secret for security
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Get current counter value
        const { data: currentData, error: fetchError } = await supabase
            .from('restore_timer')
            .select('counter')
            .eq('id', 1)
            .single();

        if (fetchError) {
            console.error('Error fetching current timer:', fetchError);
            return res.status(500).json({
                error: 'Failed to fetch restore timer',
                details: fetchError.message
            });
        }

        const currentCounter = currentData?.counter || 1;
        // Increment and reset to 1 if it reaches 10
        const newCounter = currentCounter >= 10 ? 1 : currentCounter + 1;

        // Update the counter
        const { error: updateError } = await supabase
            .from('restore_timer')
            .update({
                counter: newCounter,
                last_updated: new Date().toISOString()
            })
            .eq('id', 1);

        if (updateError) {
            console.error('Error updating restore timer:', updateError);
            return res.status(500).json({
                error: 'Failed to update restore timer',
                details: updateError.message
            });
        }

        console.log(`✅ Restore timer updated: ${currentCounter} → ${newCounter}`);

        return res.status(200).json({
            success: true,
            previousCounter: currentCounter,
            newCounter: newCounter,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Unexpected error in cron job:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}
