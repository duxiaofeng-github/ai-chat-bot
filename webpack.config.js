const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const Dotenv = require('dotenv-webpack');

const NODE_ENV = process.env.NODE_ENV;

const isProduction = NODE_ENV === 'production';

module.exports = {
  devtool: false,
  mode: isProduction ? 'production' : 'development',
  entry: {
    index: path.resolve(__dirname, 'src/index.tsx'),
  },
  output: {
    filename: isProduction ? '[name].[chunkhash:8].js' : '[name].js',
    path: isProduction ? path.resolve(__dirname, 'dist/public') : path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.(tsx|ts)$/,
        use: [
          isProduction && {
            loader: 'babel-loader', // transform es6 to es5
          },
          {
            loader: '@linaria/webpack-loader', // extract css from js
            options: {
              displayName: isProduction ? false : true,
            },
          },
          {
            loader: 'ts-loader', // transform ts to js
            options: {
              allowTsInNodeModules: true,
            },
          },
        ].filter(Boolean),
      },
      {
        test: /\.less$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
          },
          {
            loader: 'css-loader',
          },
        ],
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
          },
          {
            loader: 'css-loader',
          },
        ],
      },
      {
        test: /\.(mp4|eot|otf|ttf|jpe?g|png|webp|woff|woff2?)(\?.+)?$/,
        type: 'asset/resource',
      },
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  devServer: {
    host: '0.0.0.0',
    port: 3000,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          safari10: true,
          output: {
            comments: false,
          },
        },
      }),
      new CssMinimizerPlugin({
        minimizerOptions: {
          preset: [
            'default',
            {
              discardComments: { removeAll: true },
            },
          ],
        },
      }),
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: isProduction ? '[name]-[contenthash:8].css' : '[name].css',
    }),
    new HtmlWebpackPlugin({
      filename: isProduction ? '../index.html' : 'index.html',
      template: './src/public/index.tpl',
    }),
    new Dotenv({ systemvars: true }),
  ].filter(Boolean),
};
