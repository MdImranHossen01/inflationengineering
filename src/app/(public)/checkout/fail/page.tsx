'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle, ArrowLeft, RefreshCcw } from 'lucide-react';

export default function PaymentFailPage() {
  return (
    <div className="container min-h-[70vh] flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full border-destructive/20 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-destructive/10 rounded-full">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">Payment Failed</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            We're sorry, but your transaction could not be completed at this time.
            This could be due to incorrect details, insufficient funds, or a temporary connection issue.
          </p>
          <div className="bg-muted p-4 rounded-lg text-xs text-left">
            <p className="font-bold mb-1">Possible solutions:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Check your payment details and try again.</li>
              <li>Ensure you have sufficient balance in your account.</li>
              <li>Try a different payment method (e.g., COD).</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button 
            render={<Link href="/checkout" />}
            nativeButton={false}
            className="w-full h-11 rounded-full font-bold"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button 
            render={<Link href="/shop" />}
            nativeButton={false}
            variant="ghost" 
            className="w-full"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Shop
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

