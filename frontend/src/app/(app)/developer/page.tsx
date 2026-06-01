// ═══════════════════════════════════════════════════════
//  Merchant Developer Portal & Sandbox Playground Page
// ═══════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Zap, Terminal, Code2, ShieldCheck, 
  Copy, Check, Eye, EyeOff, Play, RefreshCw, Layers 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { useToast } from '@/hooks/useToast';
import { gatewayService, ApiKeyData } from '@/services/gateway.service';

export default function DeveloperPortalPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'keys' | 'sandbox' | 'webhooks'>('keys');

  // Keys state
  const [keys, setKeys] = useState<ApiKeyData | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [generatingKeys, setGeneratingKeys] = useState(false);

  // Playground state
  const [amount, setAmount] = useState('250');
  const [upiId, setUpiId] = useState('demo.merchant@payflow');
  const [description, setDescription] = useState('Order #12345 Payment');
  const [language, setLanguage] = useState<'curl' | 'node' | 'python'>('curl');
  
  // API execution state
  const [apiRunning, setApiRunning] = useState(false);
  const [apiResult, setApiResult] = useState<any>(null);

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('https://api.mycommerce.com/webhooks/payflow');
  const [webhookRunning, setWebhookRunning] = useState(false);
  const [webhookResult, setWebhookResult] = useState<any>(null);

  useEffect(() => {
    // Load keys from localStorage if saved
    const savedKeys = localStorage.getItem('payflow_developer_keys');
    if (savedKeys) {
      try {
        setKeys(JSON.parse(savedKeys));
      } catch {
        localStorage.removeItem('payflow_developer_keys');
      }
    }
  }, []);

  const handleGenerateKeys = async () => {
    setGeneratingKeys(true);
    try {
      const data = await gatewayService.generateKeys();
      setKeys(data);
      localStorage.setItem('payflow_developer_keys', JSON.stringify(data));
      addToast('Sandbox API Credentials generated!', 'success');
    } catch {
      addToast('Failed to generate credentials', 'error');
    } finally {
      setGeneratingKeys(false);
    }
  };

  const handleCopy = async (text: string, type: 'key' | 'secret') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'key') {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      } else {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      }
      addToast('Copied to clipboard', 'success');
    } catch {
      addToast('Copy failed', 'error');
    }
  };

  const handleRunPlayground = async () => {
    if (!keys) {
      addToast('Generate API keys first', 'error');
      return;
    }
    setApiRunning(true);
    setApiResult(null);
    try {
      const response = await gatewayService.createPaymentOrder({
        amount: Number(amount),
        upi_id: upiId,
        description
      }, keys.api_secret);
      
      setApiResult(response);
      addToast('Sandbox payment order created!', 'success');
    } catch (err: any) {
      setApiResult({
        error: true,
        message: err.message || 'Payment creation failed'
      });
      addToast('API request failed', 'error');
    } finally {
      setApiRunning(false);
    }
  };

  const handleTriggerWebhook = async () => {
    if (!keys) {
      addToast('Generate API keys first', 'error');
      return;
    }
    if (!apiResult?.payment_id) {
      addToast('Please run the Sandbox Creator first to generate a payment ID', 'error');
      return;
    }
    setWebhookRunning(true);
    setWebhookResult(null);
    try {
      const response = await gatewayService.triggerWebhook(
        apiResult.payment_id,
        'completed',
        keys.api_secret
      );
      setWebhookResult(response);
      addToast('Mock webhook successfully dispatched!', 'success');
    } catch (err: any) {
      setWebhookResult({
        error: true,
        message: err.message || 'Webhook failed to trigger'
      });
      addToast('Webhook dispatch failed', 'error');
    } finally {
      setWebhookRunning(false);
    }
  };

  // Generate dynamic code snippets
  const getCodeSnippet = () => {
    const apiBaseUrl = typeof window !== 'undefined' 
      ? window.location.origin.replace('3001', '3000') + '/v1'
      : 'http://localhost:3000/v1';

    const secretVal = keys ? keys.api_secret : 'YOUR_API_SECRET';
    const cleanUpi = upiId.replace(/'/g, "\\'");
    const cleanDesc = description.replace(/'/g, "\\'");

    switch (language) {
      case 'node':
        return `const axios = require('axios');

axios.post('${apiBaseUrl}/payments/create', {
  amount: ${amount},
  currency: 'INR',
  upi_id: '${cleanUpi}',
  description: '${cleanDesc}'
}, {
  headers: {
    'Authorization': 'Bearer ${secretVal}',
    'Content-Type': 'application/json'
  }
})
.then(res => console.log('Payment Order Created:', res.data))
.catch(err => console.error('Error:', err.message));`;

      case 'python':
        return `import requests

url = "${apiBaseUrl}/payments/create"
headers = {
    "Authorization": "Bearer ${secretVal}",
    "Content-Type": "application/json"
}
payload = {
    "amount": ${amount},
    "currency": "INR",
    "upi_id": "${cleanUpi}",
    "description": "${cleanDesc}"
}

response = requests.post(url, json=payload, headers=headers)
print("Response JSON:", response.json())`;

      case 'curl':
      default:
        return `curl -X POST "${apiBaseUrl}/payments/create" \\
  -H "Authorization: Bearer ${secretVal}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": ${amount},
    "currency": "INR",
    "upi_id": "${cleanUpi}",
    "description": "${cleanDesc}"
  }'`;
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 pb-20">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button 
          onClick={() => router.back()} 
          className="p-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:scale-105 transition-transform"
          id="dev-portal-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-surface-900 dark:text-white font-display">Developer Portal</h1>
          <p className="text-xs text-surface-500 dark:text-surface-400">Sandbox API Integrations & Webhooks</p>
        </div>
      </div>

      <div className="px-5 space-y-6">
        {/* Banner */}
        <div className="bg-indigo-500 dark:bg-indigo-650 p-5 rounded-3xl relative overflow-hidden text-white shadow-lg">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/4" />
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold">
              <Zap className="w-3 h-3 text-yellow-300" /> PayFlow Sandbox Core
            </div>
            <h2 className="text-xl font-bold font-display">Student Developer Gateway API</h2>
            <p className="text-xs text-indigo-100 leading-relaxed max-w-[90%]">
              Build your own web applications, e-commerce stores, or SaaS, and integrate PayFlow's simulated merchant gateway in 5 minutes!
            </p>
          </div>
        </div>

        {/* Tab Selectors */}
        <div className="flex bg-surface-100 dark:bg-surface-900 p-1 rounded-xl gap-1">
          {([
            ['keys', Terminal, 'API Credentials'],
            ['sandbox', Code2, 'Interactive Playground'],
            ['webhooks', Layers, 'Webhooks']
          ] as [typeof activeTab, any, string][]).map(([tab, Icon, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tab 
                  ? 'bg-white dark:bg-surface-800 text-primary-500 dark:text-white shadow-sm' 
                  : 'text-surface-500 dark:text-surface-400 hover:text-surface-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab 1: API Keys ── */}
        {activeTab === 'keys' && (
          <div className="space-y-4 animate-fade-in">
            {!keys ? (
              <Card className="bg-white dark:bg-surface-900 border-surface-200/60 dark:border-surface-800">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-500">
                    <Terminal className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-surface-800 dark:text-white">Activate Sandbox Mode</h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400 max-w-[85%] mx-auto leading-relaxed">
                      Generate your student plan API credentials to begin processing transactions and simulating webhook flows.
                    </p>
                  </div>
                  <Button 
                    fullWidth 
                    onClick={handleGenerateKeys}
                    isLoading={generatingKeys}
                    id="gen-api-keys-btn"
                  >
                    Generate API Credentials
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Credentials Panel */}
                <Card className="bg-white dark:bg-surface-900 border-surface-200/60 dark:border-surface-800">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-surface-100 dark:border-surface-800 pb-3">
                      <div className="flex items-center gap-1.5 text-success-600 dark:text-success-400">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Active Credentials</span>
                      </div>
                      <span className="text-[10px] font-bold bg-success-500/10 text-success-600 px-2 py-0.5 rounded-full uppercase">
                        {keys.plan}
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {/* API Key */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
                          Client API Key (public_key)
                        </label>
                        <div className="flex bg-surface-50 dark:bg-surface-950 p-2.5 rounded-xl border border-surface-200/50 dark:border-surface-800/40">
                          <code className="flex-1 text-xs text-surface-700 dark:text-surface-300 font-mono truncate select-all">
                            {keys.api_key}
                          </code>
                          <button 
                            onClick={() => handleCopy(keys.api_key, 'key')}
                            className="text-surface-400 hover:text-surface-600 p-0.5"
                          >
                            {copiedKey ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* API Secret */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
                          Client API Secret (secret_key)
                        </label>
                        <div className="flex bg-surface-50 dark:bg-surface-950 p-2.5 rounded-xl border border-surface-200/50 dark:border-surface-800/40">
                          <code className="flex-1 text-xs text-surface-700 dark:text-surface-300 font-mono truncate select-all">
                            {showSecret ? keys.api_secret : '••••••••••••••••••••••••••••••••'}
                          </code>
                          <div className="flex items-center gap-2 text-surface-400">
                            <button onClick={() => setShowSecret(!showSecret)} className="hover:text-surface-600 p-0.5">
                              {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button 
                              onClick={() => handleCopy(keys.api_secret, 'secret')}
                              className="hover:text-surface-600 p-0.5"
                            >
                              {copiedSecret ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Info Note */}
                <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex gap-3 text-left">
                  <Terminal className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-indigo-900 dark:text-indigo-400">Security Warning</h4>
                    <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                      Always store your `api_secret` on your backend server. Never expose it inside frontend source codes (e.g. client React codebases). Use signature header verification to authenticate webhook callbacks.
                    </p>
                  </div>
                </div>

                <Button 
                  variant="secondary" 
                  fullWidth 
                  onClick={handleGenerateKeys}
                  isLoading={generatingKeys}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Rotate Credentials
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Interactive Sandbox Playground ── */}
        {activeTab === 'sandbox' && (
          <div className="space-y-4 animate-fade-in">
            {/* Input Configurator */}
            <Card className="bg-white dark:bg-surface-900 border-surface-200/60 dark:border-surface-800">
              <CardContent className="p-4.5 space-y-4">
                <div className="flex items-center gap-1 text-primary-500 mb-1 border-b border-surface-100 dark:border-surface-800 pb-2">
                  <Code2 className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Playground Options</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input 
                    label="Transaction Amount (₹)" 
                    type="text" 
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    inputMode="decimal"
                    id="sandbox-amount"
                  />
                  <Input 
                    label="Payee VPA (upi_id)" 
                    type="text" 
                    value={upiId}
                    onChange={e => setUpiId(e.target.value)}
                    id="sandbox-vpa"
                  />
                </div>

                <Input 
                  label="Description" 
                  type="text" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  id="sandbox-desc"
                />
              </CardContent>
            </Card>

            {/* Code snippets */}
            <Card className="bg-[#0b1326] text-white border-none shadow-md overflow-hidden flex flex-col">
              <div className="px-4 py-2.5 bg-[#141f36] flex items-center justify-between border-b border-surface-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold font-mono">Create Payment Order</span>
                </div>
                <div className="flex gap-1.5">
                  {(['curl', 'node', 'python'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                        language === lang 
                          ? 'bg-indigo-500 text-white' 
                          : 'text-surface-400 hover:text-white'
                      }`}
                    >
                      {lang === 'node' ? 'Node' : lang === 'python' ? 'Python' : 'cURL'}
                    </button>
                  ))}
                </div>
              </div>
              <pre className="p-4 text-[10px] font-mono overflow-x-auto text-left leading-relaxed text-indigo-200 select-all max-h-48 whitespace-pre-wrap">
                {getCodeSnippet()}
              </pre>
            </Card>

            {/* Run Button */}
            <Button 
              fullWidth 
              onClick={handleRunPlayground}
              isLoading={apiRunning}
              id="sandbox-run-btn"
            >
              <Play className="w-4 h-4 mr-2" /> Execute API Request
            </Button>

            {/* API Console Result */}
            {apiResult && (
              <Card className="bg-white dark:bg-surface-900 border-surface-200/60 dark:border-surface-800 overflow-hidden animate-slide-up">
                <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-surface-800 dark:text-white uppercase tracking-wider">
                    API Response Console
                  </h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    apiResult.error ? 'bg-danger-500/10 text-danger-500' : 'bg-success-500/10 text-success-600'
                  }`}>
                    {apiResult.error ? 'HTTP 400 Bad Request' : 'HTTP 201 Created'}
                  </span>
                </div>
                <CardContent className="p-4 space-y-4">
                  {/* Dynamic payment QR if successful */}
                  {!apiResult.error && apiResult.qr_code && (
                    <div className="flex flex-col items-center p-4 bg-surface-50 dark:bg-surface-950 rounded-2xl border border-surface-100 dark:border-surface-800/40">
                      <div className="bg-white p-2.5 rounded-xl border border-surface-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180&data=${encodeURIComponent(apiResult.qr_code)}`} 
                          alt="Merchant QR" 
                          className="w-40 h-40"
                        />
                      </div>
                      <p className="text-[10px] text-surface-500 mt-2">
                        Simulated Merchant QR created for Payment ID: <strong>{apiResult.payment_id}</strong>
                      </p>
                    </div>
                  )}

                  {/* Highlighted JSON response */}
                  <pre className="p-3.5 bg-surface-100 dark:bg-surface-950 rounded-xl text-[10px] text-left font-mono overflow-x-auto text-surface-700 dark:text-surface-300 border border-surface-200/30 dark:border-surface-800/40">
                    {JSON.stringify(apiResult, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Tab 3: Webhooks Simulator ── */}
        {activeTab === 'webhooks' && (
          <div className="space-y-4 animate-fade-in">
            <Card className="bg-white dark:bg-surface-900 border-surface-200/60 dark:border-surface-800">
              <CardContent className="p-4.5 space-y-4">
                <div className="flex items-center gap-1 text-primary-500 mb-1 border-b border-surface-100 dark:border-surface-800 pb-2">
                  <Layers className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Configure Webhook</span>
                </div>

                <Input 
                  label="Target Webhook URL" 
                  type="text" 
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  id="webhook-url"
                />

                <div className="space-y-1 bg-surface-50 dark:bg-surface-950 p-3 rounded-2xl border border-surface-100 dark:border-surface-800 text-left">
                  <span className="text-[9px] font-bold text-surface-400 uppercase tracking-wider">Payload Blueprint</span>
                  <pre className="text-[9px] font-mono text-surface-600 dark:text-surface-400 mt-1 select-all overflow-x-auto">
{`{
  "event": "payment.completed",
  "data": {
    "payment_id": "${apiResult?.payment_id || 'pay_abc123'} ",
    "amount": ${amount},
    "currency": "INR",
    "status": "completed",
    "created_at": "${new Date().toISOString()}"
  }
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>

            <Button 
              fullWidth 
              onClick={handleTriggerWebhook}
              isLoading={webhookRunning}
              disabled={!apiResult?.payment_id}
              id="webhook-trigger-btn"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${webhookRunning ? 'animate-spin' : ''}`} />
              Simulate completed Hook Event
            </Button>

            {!apiResult?.payment_id && (
              <p className="text-[10px] text-center text-danger-500 font-semibold bg-danger-500/10 py-1.5 px-3 rounded-xl">
                ⚠️ Run the Sandbox Creator in Tab 2 first to generate a transaction!
              </p>
            )}

            {webhookResult && (
              <Card className="bg-white dark:bg-surface-900 border-surface-200/60 dark:border-surface-800 overflow-hidden animate-slide-up">
                <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-surface-800 dark:text-white uppercase tracking-wider">
                    Webhook Logs console
                  </h4>
                  <span className="text-[10px] font-bold bg-success-500/10 text-success-600 px-2 py-0.5 rounded">
                    HTTP 200 Success
                  </span>
                </div>
                <CardContent className="p-4">
                  <pre className="p-3 bg-surface-100 dark:bg-surface-950 rounded-xl text-[10px] text-left font-mono overflow-x-auto text-surface-700 dark:text-surface-300 border border-surface-200/30 dark:border-surface-800/40">
                    {JSON.stringify(webhookResult, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
