import React, { useState } from 'react';
import { Star, Send, Loader2, Smile } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Customer } from '../types';
import { analyzeSentiment } from '../services/geminiService';

interface FeedbackPageProps {
  user: Customer | null;
}

const FeedbackPage: React.FC<FeedbackPageProps> = ({ user }) => {
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;

    setIsSubmitting(true);
    
    try {
      // 1. AI Analysis (Optional)
      const aiResult = await analyzeSentiment(content);
      console.log('AI Sentiment Analysis:', aiResult);

      // 2. Insert to Supabase
      // Note: 'rating' column does not exist in DB, so we append it to text to preserve data.
      const finalContent = `[Rating: ${rating}/5] ${content}`;

      const { error } = await supabase.from('feedbacks').insert({
        customer_id: user.id,
        text: finalContent, 
        sentiment: aiResult.sentiment || 'neutral',
        customer_name: user.name
      });

      if (error) {
        console.error('Feedback Insert Error:', JSON.stringify(error, null, 2));
        throw error;
      }

      setSuccess(true);
      setContent('');
      setRating(5);
      
      setTimeout(() => setSuccess(false), 4000);

    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err);
      console.error('Feedback error:', errorMsg);
      alert('提交失败，请检查网络或稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] p-6 text-center animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600">
                <Smile size={40} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">感谢您的评价！</h2>
            <p className="text-gray-500">您的反馈对我们非常重要，我们会持续改进服务。</p>
            <button 
                onClick={() => setSuccess(false)}
                className="mt-8 px-8 py-2 rounded-full border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
            >
                再写一条
            </button>
        </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="px-6 pt-12 pb-4 bg-white">
        <h1 className="text-2xl font-bold text-slate-900">服务评价</h1>
        <p className="text-sm text-gray-500 mt-1">告诉我们您的体验如何</p>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Rating Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
            <label className="text-sm font-medium text-gray-600 mb-4">您对本次服务满意吗？</label>
            <div className="flex space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="focus:outline-none transition-transform hover:scale-110"
                >
                <Star
                    size={32}
                    className={`${
                    star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
                    } transition-colors duration-200`}
                />
                </button>
            ))}
            </div>
            <div className="mt-3 text-sm font-medium text-indigo-600">
                {rating === 5 && "非常满意"}
                {rating === 4 && "满意"}
                {rating === 3 && "一般"}
                {rating === 2 && "不满意"}
                {rating === 1 && "非常失望"}
            </div>
        </div>

        {/* Text Area - Styled darker/richer */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="bg-gray-100 rounded-lg p-1">
                <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="展开说说您的想法，比如服务态度、环境设施等..."
                className="w-full h-40 p-3 resize-none bg-transparent focus:outline-none text-slate-800 placeholder:text-gray-500 text-sm"
                maxLength={500}
                />
            </div>
            <div className="text-right text-xs text-gray-400 mt-2">
                {content.length}/500
            </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="w-full rounded-full bg-slate-900 py-4 text-white shadow-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-bold text-lg transition-all active:scale-95"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              提交中...
            </>
          ) : (
            <>
              <Send className="mr-2 h-5 w-5" />
              提交评价
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default FeedbackPage;