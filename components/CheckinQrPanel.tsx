async function updateExpiry() {
    if (!expiryDate || !expiryTime) {
      alert('請設定到期日期與時間');
      return;
    }
    const newExpiry = localDateTimeToIso(expiryDate, expiryTime);

    setLoading(true);
    try {
      const { error } = await supabase
        .from('activities')
        .update({ checkin_token_expires_at: newExpiry })
        .eq('id', activityId);

      if (error) {
        alert('更新到期時間失敗:' + error.message);
        return;
      }
      setExpiresAt(newExpiry);
      alert('已更新到期時間,QR code 不變');
    } finally {
      setLoading(false);
    }
  }
