-- The server POSTs to every stored endpoint, so endpoints must belong to a real browser push
-- service (prevents SSRF via a user-supplied URL). save_push_subscription becomes the only
-- write path: the direct INSERT/UPDATE policies are dropped. Keep the host list in sync with
-- lib/notifications/endpoints.ts.

DROP POLICY IF EXISTS "Users insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users update own push subscriptions" ON public.push_subscriptions;

CREATE OR REPLACE FUNCTION public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com|([a-z0-9-]+\.)*push\.apple\.com)/' THEN
    RAISE EXCEPTION 'Invalid push endpoint';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent)
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_push_subscription(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO authenticated;
