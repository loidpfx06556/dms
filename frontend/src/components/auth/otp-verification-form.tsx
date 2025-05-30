import { Label } from "@radix-ui/react-label";
import { Loader2 } from "lucide-react";
import React, { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const TIMER_DURATION = 5 * 60; // 5 minutes in seconds
const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 1800; // 30 minutes in seconds

interface OtpVerificationResponse {
  data?: {
    verified: boolean;
    locked: boolean;
    otpCount: number;
    expired: boolean;
  };
}

interface OtpVerificationFormProps {
  onVerified: (otp: string) => Promise<OtpVerificationResponse>;
  onResend: () => Promise<void>;
}

export default function OtpVerificationForm({ onVerified, onResend }: OtpVerificationFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(TIMER_DURATION);
  const [isLocked, setIsLocked] = useState(false);
  const [isLockTimer, setIsLockTimer] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [otpValue, setOtpValue] = useState("");
  const [resending, setResending] = useState(false);

  // Timer countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Lock timer countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (lockTimer > 0) {
      interval = setInterval(() => {
        setLockTimer((prev) => prev - 1);
      }, 1000);
    } else if (lockTimer === 0 && isLockTimer) {
      setIsLockTimer(false);
    }
    return () => clearInterval(interval);
  }, [lockTimer, isLocked]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleResendOtp = async (): Promise<void> => {
    setResending(true);
    try {
      await onResend();
      setTimer(TIMER_DURATION);
      toast({
        title: t("common.success"),
        description: t("auth.otp.resendSuccess"),
        variant: "success",
      });
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("auth.otp.resendError"),
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (isLockTimer || isLocked || !otpValue || otpValue.length !== 6) return;

    setIsLoading(true);
    const response = await onVerified(otpValue);
    if (response?.data) {
      if (response.data.locked) {
        setIsLocked(true);
        setOtpValue("");
      } else if (!response.data.verified) {
        if (response.data.expired) {
          setOtpValue("");
          toast({
            title: t("common.error"),
            description: t("auth.otp.otpExpired"),
            variant: "destructive",
          });
        } else if (response.data.otpCount >= MAX_ATTEMPTS) {
          setIsLocked(true);
          setLockTimer(LOCK_DURATION);
          toast({
            title: t("common.error"),
            description: t("auth.otp.maxAttemptsReached", { time: formatTime(LOCK_DURATION) }),
            variant: "destructive",
          });
        } else {
          setOtpValue("");
          toast({
            title: t("common.error"),
            description: t("auth.otp.verifyError", { remaining: MAX_ATTEMPTS - response.data.otpCount }),
            variant: "destructive",
          });
        }
      }
    } else {
      setOtpValue("");
      toast({
        title: t("common.error"),
        description: t("auth.otp.verifyError"),
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  const handleOtpChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value.replace(/[^\d]/g, "").slice(0, 6);
    setOtpValue(value);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("auth.otp.title")}</CardTitle>
        <CardDescription>{t("auth.otp.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("auth.otp.code")}</Label>
            <Input
              value={otpValue}
              onChange={handleOtpChange}
              disabled={isLoading || isLockTimer || isLocked}
              placeholder={t("auth.otp.code")}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
            />
          </div>

          <div className="flex flex-col gap-4">
            <Button
              type="submit"
              disabled={isLoading || isLockTimer || isLocked || otpValue?.length !== 6}
              className="w-full"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("auth.otp.verify")}
            </Button>

            {isLockTimer || isLocked ? (
              <div className="text-center text-sm text-muted-foreground">
                {t("auth.otp.lockedMessage", { time: isLockTimer ? formatTime(lockTimer) : "" })}
              </div>
            ) : (
              <>
                <div className="text-center text-sm text-muted-foreground">
                  {t("auth.otp.expiresIn", { time: formatTime(timer) })}
                </div>

                <Button
                  type="button"
                  variant="link"
                  disabled={resending || timer > 0}
                  onClick={handleResendOtp}
                  className="w-full"
                >
                  {resending ? (
                    <span className="flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("auth.otp.resending")}
                    </span>
                  ) : (
                    t("auth.otp.resend")
                  )}
                </Button>
              </>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}