import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';

const execAsync = promisify(exec);

export class SessionUnlocker {
  /**
   * Unlocks the current user's session using loginctl.
   * This is the standard way to unlock sessions in modern Linux desktops (GNOME, KDE).
   */
  public async unlock(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const args = ['unlock-session'];
      
      const sessionId = process.env.XDG_SESSION_ID;
      if (sessionId) {
        args.push(sessionId);
      }

      const proc = spawn('loginctl', args, {
        shell: false,
      });

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ 
            success: false, 
            error: stderr.trim() || `loginctl exited with code ${code}` 
          });
        }
      });

      proc.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Fallback for systems where loginctl might not work as expected.
   * Uses D-Bus to communicate with the ScreenSaver interface.
   */
  public async unlockFallback(): Promise<{ success: boolean; error?: string }> {
    // Try GNOME screensaver first
    try {
      await execAsync('gdbus call --session --dest org.gnome.ScreenSaver --object-path /org/gnome/ScreenSaver --method org.gnome.ScreenSaver.SetActive false');
      return { success: true };
    } catch (gnomeErr: any) {
      // Try Freedesktop/KDE screensaver
      try {
        await execAsync('qdbus org.freedesktop.ScreenSaver /ScreenSaver SetActive false');
        return { success: true };
      } catch (kdeErr: any) {
        // Last resort: generic dbus-send
        try {
          await execAsync('dbus-send --session --dest=org.freedesktop.ScreenSaver --type=method_call /ScreenSaver org.freedesktop.ScreenSaver.SetActive boolean:false');
          return { success: true };
        } catch (finalErr: any) {
          return { 
            success: false, 
            error: `All unlock methods failed. loginctl failed and D-Bus fallback failed: ${finalErr.message}` 
          };
        }
      }
    }
  }

  /**
   * Orchestrates the unlock process, trying loginctl first and then D-Bus.
   */
  public async performUnlock(): Promise<{ success: boolean; error?: string }> {
    const result = await this.unlock();
    if (result.success) return result;
    
    console.warn(`loginctl failed: ${result.error}. Trying D-Bus fallback...`);
    return this.unlockFallback();
  }
}
